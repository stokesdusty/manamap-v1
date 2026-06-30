import { Injectable, NotFoundException } from '@nestjs/common';
import type { DeckSite } from '@prisma/client';
import {
  siteFromUrl,
  type CreateDeckLink,
  type OnboardingSubmit,
  type SetHomeStore,
  type UpdateDeckLink,
  type UpdatePrivacy,
  type UpdateProfile,
} from '@manamap/shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { EndorsementsService } from '../endorsements/endorsements.service';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly endorsements: EndorsementsService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const endorsements = await this.endorsements.getSummary(userId);
    return { ...user, endorsements };
  }

  async updateProfile(userId: string, dto: UpdateProfile) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.pronouns !== undefined ? { pronouns: dto.pronouns } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.avatarColors !== undefined ? { avatarColors: dto.avatarColors } : {}),
        ...(dto.commander !== undefined ? { commander: dto.commander } : {}),
        ...(dto.powerLevel !== undefined ? { powerLevel: dto.powerLevel } : {}),
        ...(dto.vibes !== undefined ? { vibes: dto.vibes } : {}),
        ...(dto.formats !== undefined ? { formats: dto.formats } : {}),
        ...(dto.spelltable !== undefined ? { spelltable: dto.spelltable } : {}),
        ...(dto.convokeGames !== undefined ? { convokeGames: dto.convokeGames } : {}),
        ...(dto.tradeWants !== undefined ? { tradeWants: dto.tradeWants } : {}),
        ...(dto.tradeHaves !== undefined ? { tradeHaves: dto.tradeHaves } : {}),
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
        storeMessages: true,
        shareNameWithContacts: false,
        eventReminders: true,
      }
    );
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacy) {
    const patch = {
      ...(dto.discoverable !== undefined ? { discoverable: dto.discoverable } : {}),
      ...(dto.showDiscord !== undefined ? { showDiscord: dto.showDiscord } : {}),
      ...(dto.showDecks !== undefined ? { showDecks: dto.showDecks } : {}),
      ...(dto.showMetHistory !== undefined ? { showMetHistory: dto.showMetHistory } : {}),
      ...(dto.storeMessages !== undefined ? { storeMessages: dto.storeMessages } : {}),
      ...(dto.shareNameWithContacts !== undefined
        ? { shareNameWithContacts: dto.shareNameWithContacts }
        : {}),
      ...(dto.eventReminders !== undefined ? { eventReminders: dto.eventReminders } : {}),
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
        storeMessages: dto.storeMessages ?? true,
        shareNameWithContacts: dto.shareNameWithContacts ?? false,
        eventReminders: dto.eventReminders ?? true,
      },
    });
  }

  async getDecks(userId: string) {
    const decks = await this.prisma.deckLink.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return decks.map((d) => ({ ...d, site: d.site?.toLowerCase() ?? null }));
  }

  async createDeck(userId: string, dto: CreateDeckLink) {
    const site = dto.url ? siteFromUrl(dto.url) : null;
    const deck = await this.prisma.deckLink.create({
      data: {
        userId,
        name: dto.name,
        url: dto.url ?? null,
        site: site ? (site.toUpperCase() as DeckSite) : null,
      },
    });
    return { ...deck, site: deck.site?.toLowerCase() ?? null };
  }

  async updateDeck(userId: string, deckId: string, dto: UpdateDeckLink) {
    const existing = await this.prisma.deckLink.findFirst({ where: { id: deckId, userId } });
    if (!existing) throw new NotFoundException('Deck not found');

    const deck = await this.prisma.deckLink.update({
      where: { id: deckId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.url !== undefined
          ? {
              url: dto.url,
              site: dto.url ? ((siteFromUrl(dto.url)?.toUpperCase() as DeckSite) ?? null) : null,
            }
          : {}),
      },
    });
    return { ...deck, site: deck.site?.toLowerCase() ?? null };
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
      id: string;
      name: string;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      discordUrl: string | null;
      lat: number | null;
      lng: number | null;
    };

    const rows = await this.prisma.$queryRaw<HomeStoreRow[]>`
      SELECT
        id, name, address, city, state, zip,
        discord_url AS "discordUrl",
        CASE WHEN geom IS NOT NULL THEN ST_Y(geom::geometry) ELSE NULL END AS lat,
        CASE WHEN geom IS NOT NULL THEN ST_X(geom::geometry) ELSE NULL END AS lng
      FROM stores
      WHERE id = ${user.homeStoreId}
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

  async getRecentStores(userId: string) {
    type RecentStoreRow = {
      id: string;
      name: string;
      city: string | null;
      state: string | null;
    };
    return this.prisma.$queryRaw<RecentStoreRow[]>`
      SELECT DISTINCT ON (c.store_id)
        s.id, s.name, s.city, s.state
      FROM checkins c
      JOIN stores s ON s.id = c.store_id
      WHERE c.user_id = ${userId}
      ORDER BY c.store_id, c.checked_in_at DESC
      LIMIT 10
    `.then((rows) => ({ stores: rows }));
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

  async getGameStats(userId: string) {
    const games = await this.prisma.gameLog.findMany({
      where: {
        status: 'CONFIRMED',
        players: { some: { userId } },
      },
      select: {
        winnerId: true,
        players: {
          where: { userId },
          select: { deck: true },
        },
      },
    });

    let wins = 0;
    let losses = 0;
    const deckMap = new Map<string, { wins: number; losses: number }>();

    for (const game of games) {
      const isWin = game.winnerId === userId;
      if (isWin) wins++;
      else losses++;

      const deck = game.players[0]?.deck;
      if (deck) {
        const stats = deckMap.get(deck) ?? { wins: 0, losses: 0 };
        if (isWin) stats.wins++;
        else stats.losses++;
        deckMap.set(deck, stats);
      }
    }

    const total = wins + losses;
    const byDeck = Array.from(deckMap.entries())
      .map(([deck, stats]) => ({
        deck,
        wins: stats.wins,
        losses: stats.losses,
        rate: stats.wins + stats.losses > 0 ? stats.wins / (stats.wins + stats.losses) : 0,
      }))
      .sort((a, b) => b.wins + b.losses - (a.wins + a.losses));

    return {
      games: total,
      wins,
      losses,
      winRate: total > 0 ? wins / total : 0,
      byDeck,
    };
  }

  async setHomeStore(userId: string, dto: SetHomeStore) {
    if (dto.storeId) {
      const exists = await this.prisma.store.findUnique({
        where: { id: dto.storeId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Store not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { homeStoreId: dto.storeId },
    });

    return { storeId: dto.storeId };
  }

  async submitOnboarding(userId: string, dto: OnboardingSubmit) {
    if (dto.homeStoreId) {
      const store = await this.prisma.store.findUnique({
        where: { id: dto.homeStoreId },
        select: { id: true },
      });
      if (!store) throw new NotFoundException('Store not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          displayName: dto.displayName,
          pronouns: dto.pronouns ?? null,
          avatarColors: dto.avatarColors,
          formats: dto.formats,
          commander: dto.commander ?? null,
          powerLevel: dto.powerLevel ?? null,
          vibes: dto.vibes ?? [],
          bio: dto.bio ?? null,
          ...(dto.homeStoreId !== undefined ? { homeStoreId: dto.homeStoreId } : {}),
          onboardedAt: new Date(),
        },
      });

      await tx.privacySettings.upsert({
        where: { userId },
        update: {
          discoverable: dto.discoverable ?? true,
          ...(dto.shareNameWithContacts !== undefined
            ? { shareNameWithContacts: dto.shareNameWithContacts }
            : {}),
        },
        create: {
          userId,
          discoverable: dto.discoverable ?? true,
          showDiscord: true,
          showDecks: true,
          showMetHistory: true,
          shareNameWithContacts: dto.shareNameWithContacts ?? false,
        },
      });

      if (dto.decks?.length) {
        await tx.deckLink.createMany({
          data: dto.decks.map((d) => ({
            userId,
            name: d.name,
            url: d.url ?? null,
            site: d.url ? ((siteFromUrl(d.url)?.toUpperCase() as DeckSite) ?? null) : null,
          })),
          skipDuplicates: true,
        });
      }

      return user;
    });
  }
}
