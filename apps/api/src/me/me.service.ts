import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeckSite, Prisma } from '@prisma/client';
import {
  DECK_SITE_HOSTS,
  type CreateDeckLink,
  type SetHomeStore,
  type UpdateDeckLink,
  type UpdatePrivacy,
  type UpdateProfile,
} from '@manamap/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfile) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.pronouns !== undefined ? { pronouns: dto.pronouns } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.avatarColors !== undefined ? { avatarColors: dto.avatarColors } : {}),
        ...(dto.commander !== undefined ? { commander: dto.commander } : {}),
        ...(dto.powerLevel !== undefined ? { powerLevel: dto.powerLevel } : {}),
        ...(dto.vibe !== undefined ? { vibe: dto.vibe } : {}),
        ...(dto.formats !== undefined ? { formats: dto.formats } : {}),
      },
    });
  }

  async getPrivacy(userId: string) {
    const s = await this.prisma.privacySettings.findUnique({ where: { userId } });
    return (
      s ?? {
        discoverable: true,
        showDiscord: true,
        showDecks: true,
        showMetHistory: true,
      }
    );
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacy) {
    const patch = {
      ...(dto.discoverable !== undefined ? { discoverable: dto.discoverable } : {}),
      ...(dto.showDiscord !== undefined ? { showDiscord: dto.showDiscord } : {}),
      ...(dto.showDecks !== undefined ? { showDecks: dto.showDecks } : {}),
      ...(dto.showMetHistory !== undefined ? { showMetHistory: dto.showMetHistory } : {}),
    };
    return this.prisma.privacySettings.upsert({
      where: { userId },
      update: patch,
      create: {
        userId,
        discoverable: dto.discoverable ?? true,
        showDiscord: dto.showDiscord ?? true,
        showDecks: dto.showDecks ?? true,
        showMetHistory: dto.showMetHistory ?? true,
      },
    });
  }

  async getDecks(userId: string) {
    const decks = await this.prisma.deckLink.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return decks.map((d) => ({ ...d, site: d.site.toLowerCase() }));
  }

  async createDeck(userId: string, dto: CreateDeckLink) {
    const deck = await this.prisma.deckLink.create({
      data: { userId, site: dto.site.toUpperCase() as DeckSite, name: dto.name, url: dto.url },
    });
    return { ...deck, site: deck.site.toLowerCase() };
  }

  async updateDeck(userId: string, deckId: string, dto: UpdateDeckLink) {
    const existing = await this.prisma.deckLink.findFirst({ where: { id: deckId, userId } });
    if (!existing) throw new NotFoundException('Deck not found');

    if (dto.url && !dto.site) {
      const existingSite = existing.site.toLowerCase() as keyof typeof DECK_SITE_HOSTS;
      const expected = DECK_SITE_HOSTS[existingSite];
      const actual = new URL(dto.url).hostname.replace(/^www\./, '');
      if (actual !== expected && !actual.endsWith(`.${expected}`)) {
        throw new BadRequestException(`URL must be a ${expected} link`);
      }
    }

    const deck = await this.prisma.deckLink.update({
      where: { id: deckId },
      data: {
        ...(dto.site !== undefined ? { site: dto.site.toUpperCase() as DeckSite } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
      },
    });
    return { ...deck, site: deck.site.toLowerCase() };
  }

  async deleteDeck(userId: string, deckId: string) {
    const existing = await this.prisma.deckLink.findFirst({ where: { id: deckId, userId } });
    if (!existing) throw new NotFoundException('Deck not found');
    await this.prisma.deckLink.delete({ where: { id: deckId } });
  }

  async registerPushToken(userId: string, token: string) {
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId },
      create: { userId, token },
    });
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Home store
  // -------------------------------------------------------------------------

  async getHomeStore(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { homeStoreId: true },
    });
    if (!user || !user.homeStoreId) return { store: null };

    type HomeStoreRow = {
      id: string; name: string; address: string | null; city: string | null;
      state: string | null; zip: string | null; discordUrl: string | null;
      lat: number | null; lng: number | null;
    };

    const rows = await this.prisma.$queryRaw<HomeStoreRow[]>`
      SELECT
        id, name, address, city, state, zip,
        discord_url AS "discordUrl",
        CASE WHEN geom IS NOT NULL THEN ST_Y(geom::geometry) ELSE NULL END AS lat,
        CASE WHEN geom IS NOT NULL THEN ST_X(geom::geometry) ELSE NULL END AS lng
      FROM stores
      WHERE id = ${Prisma.sql`${user.homeStoreId}::uuid`}
    `;

    if (!rows.length) return { store: null };
    const r = rows[0];
    return {
      store: {
        ...r,
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
      },
    };
  }

  async getBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      select: {
        id: true,
        earnedAt: true,
        store: { select: { id: true, name: true } },
        badge: { select: { id: true, code: true, name: true, icon: true, description: true } },
      },
      orderBy: { earnedAt: 'desc' },
    });
  }

  async getStreaksSummary(userId: string) {
    const streaks = await this.prisma.streak.findMany({
      where: { userId },
      select: { currentStreak: true, longestStreak: true, totalCheckins: true },
    });

    if (streaks.length === 0) {
      return { bestCurrentStreak: 0, bestLongestStreak: 0, totalCheckins: 0 };
    }

    return {
      bestCurrentStreak: Math.max(...streaks.map((s) => s.currentStreak)),
      bestLongestStreak: Math.max(...streaks.map((s) => s.longestStreak)),
      totalCheckins: streaks.reduce((sum, s) => sum + s.totalCheckins, 0),
    };
  }

  async setHomeStore(userId: string, dto: SetHomeStore) {
    if (dto.storeId) {
      const exists = await this.prisma.store.findUnique({ where: { id: dto.storeId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Store not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { homeStoreId: dto.storeId },
    });

    return { storeId: dto.storeId };
  }
}
