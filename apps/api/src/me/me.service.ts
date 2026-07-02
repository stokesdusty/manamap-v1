import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, type DeckSite } from '@prisma/client';
import {
  siteFromUrl,
  type CreateDeckLink,
  type OnboardingSubmit,
  type SetHomeStore,
  type UpdateDeckLink,
  type UpdatePrivacy,
  type UpdateProfile,
} from '@manamap/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EndorsementsService } from '../endorsements/endorsements.service';
import { EventRemindersService } from '../event-reminders/event-reminders.service';
import { PresenceService } from '../presence/presence.service';
import { LfgService } from '../lfg/lfg.service';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly endorsements: EndorsementsService,
    private readonly eventReminders: EventRemindersService,
    private readonly presence: PresenceService,
    private readonly lfg: LfgService,
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

  // -------------------------------------------------------------------------
  // Data export & account deletion (GDPR / CCPA)
  // -------------------------------------------------------------------------

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [
      privacy,
      decks,
      socialLinks,
      badges,
      streaks,
      checkins,
      eventAttendance,
      sentConnections,
      receivedConnections,
      encounters,
      gamePlayers,
      endorsementsGiven,
      endorsementsReceived,
      offerRedemptions,
      blocksMade,
      reportsMade,
    ] = await Promise.all([
      this.getPrivacy(userId),
      this.getDecks(userId),
      this.prisma.socialLink.findMany({
        where: { userId },
        select: { id: true, platform: true, value: true, visibility: true, sort: true },
        orderBy: { sort: 'asc' },
      }),
      this.getBadges(userId),
      this.prisma.streak.findMany({
        where: { userId },
        select: {
          currentStreak: true,
          longestStreak: true,
          totalCheckins: true,
          lastCheckinAt: true,
          store: { select: { id: true, name: true } },
        },
      }),
      this.prisma.checkin.findMany({
        where: { userId },
        select: {
          id: true,
          eventId: true,
          checkedInAt: true,
          checkedOutAt: true,
          store: { select: { id: true, name: true } },
        },
        orderBy: { checkedInAt: 'desc' },
      }),
      this.prisma.eventAttendee.findMany({
        where: { userId },
        select: { id: true, rsvpAt: true, event: { select: { id: true, name: true } } },
        orderBy: { rsvpAt: 'desc' },
      }),
      this.prisma.connection.findMany({
        where: { requesterId: userId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          addressee: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.connection.findMany({
        where: { addresseeId: userId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          requester: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.encounter.findMany({
        where: { userId },
        select: {
          id: true,
          result: true,
          storeId: true,
          createdAt: true,
          opponent: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.gamePlayer.findMany({
        where: { userId },
        select: {
          deck: true,
          gameLog: {
            select: {
              id: true,
              storeId: true,
              format: true,
              status: true,
              winnerId: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.endorsement.findMany({
        where: { fromUserId: userId },
        select: { id: true, tag: true, createdAt: true, toUser: { select: { id: true, displayName: true } } },
      }),
      this.prisma.endorsement.findMany({
        where: { toUserId: userId },
        select: { id: true, tag: true, createdAt: true, fromUser: { select: { id: true, displayName: true } } },
      }),
      this.prisma.offerRedemption.findMany({
        where: { userId },
        select: {
          id: true,
          code: true,
          status: true,
          createdAt: true,
          redeemedAt: true,
          store: { select: { id: true, name: true } },
        },
      }),
      this.prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true, createdAt: true },
      }),
      this.prisma.report.findMany({
        where: { reporterId: userId },
        select: {
          id: true,
          reportedId: true,
          reason: true,
          detail: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: { ...user, endorsements: await this.endorsements.getSummary(userId) },
      privacy,
      decks,
      socialLinks,
      badges,
      streaks: streaks.map((s) => ({
        storeId: s.store.id,
        storeName: s.store.name,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        totalCheckins: s.totalCheckins,
        lastCheckinAt: s.lastCheckinAt,
      })),
      checkins: checkins.map((c) => ({
        id: c.id,
        storeId: c.store.id,
        storeName: c.store.name,
        eventId: c.eventId,
        checkedInAt: c.checkedInAt,
        checkedOutAt: c.checkedOutAt,
      })),
      eventAttendance: eventAttendance.map((a) => ({
        id: a.id,
        eventId: a.event.id,
        eventName: a.event.name,
        rsvpAt: a.rsvpAt,
      })),
      connections: [
        ...sentConnections.map((c) => ({
          id: c.id,
          otherUserId: c.addressee.id,
          otherUserName: c.addressee.displayName,
          direction: 'sent' as const,
          status: c.status.toLowerCase(),
          createdAt: c.createdAt,
        })),
        ...receivedConnections.map((c) => ({
          id: c.id,
          otherUserId: c.requester.id,
          otherUserName: c.requester.displayName,
          direction: 'received' as const,
          status: c.status.toLowerCase(),
          createdAt: c.createdAt,
        })),
      ],
      encounters: encounters.map((e) => ({
        id: e.id,
        opponentId: e.opponent.id,
        opponentName: e.opponent.displayName,
        result: e.result,
        storeId: e.storeId,
        createdAt: e.createdAt,
      })),
      games: gamePlayers.map((gp) => ({
        id: gp.gameLog.id,
        storeId: gp.gameLog.storeId,
        format: gp.gameLog.format,
        status: gp.gameLog.status,
        isWinner: gp.gameLog.winnerId === userId,
        deck: gp.deck,
        createdAt: gp.gameLog.createdAt,
      })),
      endorsementsGiven: endorsementsGiven.map((e) => ({
        id: e.id,
        otherUserId: e.toUser.id,
        otherUserName: e.toUser.displayName,
        tag: e.tag,
        createdAt: e.createdAt,
      })),
      endorsementsReceived: endorsementsReceived.map((e) => ({
        id: e.id,
        otherUserId: e.fromUser.id,
        otherUserName: e.fromUser.displayName,
        tag: e.tag,
        createdAt: e.createdAt,
      })),
      offerRedemptions: offerRedemptions.map((r) => ({
        id: r.id,
        storeId: r.store.id,
        storeName: r.store.name,
        code: r.code,
        status: r.status,
        createdAt: r.createdAt,
        redeemedAt: r.redeemedAt,
      })),
      blocksMade: blocksMade.map((b) => ({ blockedUserId: b.blockedId, createdAt: b.createdAt })),
      reportsMade: reportsMade.map((r) => ({
        id: r.id,
        reportedUserId: r.reportedId,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Anonymizes and deactivates the account rather than hard-deleting the User row:
   * GameLog/Encounter/Connection records the user participated in are other users'
   * data too (confirmed W/L history, shared encounters), so erasing the row outright
   * would corrupt everyone else's records. PII is scrubbed and every
   * session/device/preference record is hard-deleted instead; deletedAt blocks the
   * account in AuthGuard immediately even if an access token hasn't expired yet.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) return;

    const attending = await this.prisma.eventAttendee.findMany({
      where: { userId },
      select: { eventId: true },
    });
    await Promise.all(
      attending.map((a) => this.eventReminders.cancelReminders(userId, a.eventId).catch(() => undefined)),
    );
    await Promise.all([
      this.presence.checkout(userId).catch(() => undefined),
      this.lfg.remove(userId).catch(() => undefined),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.pushToken.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.identity.deleteMany({ where: { userId } });
      await tx.deckLink.deleteMany({ where: { userId } });
      await tx.socialLink.deleteMany({ where: { userId } });
      await tx.questProgress.deleteMany({ where: { userId } });
      await tx.storeConfirmation.deleteMany({ where: { userId } });
      await tx.eventAttendee.deleteMany({ where: { userId } });
      await tx.checkin.deleteMany({ where: { userId } });
      await tx.streak.deleteMany({ where: { userId } });
      await tx.userBadge.deleteMany({ where: { userId } });
      await tx.storeOwnership.deleteMany({ where: { userId } });
      await tx.privacySettings.deleteMany({ where: { userId } });
      await tx.connection.deleteMany({
        where: { status: 'PENDING', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@manamap.invalid`,
          name: null,
          displayName: 'Deleted User',
          avatarUrl: null,
          bio: null,
          pronouns: null,
          avatarColors: [],
          commander: null,
          powerLevel: null,
          vibes: [],
          formats: [],
          spelltable: false,
          convokeGames: false,
          homeStoreId: null,
          lastLat: null,
          lastLng: null,
          lastLocatedAt: null,
          tradeWants: null,
          tradeHaves: null,
          role: UserRole.USER,
          deletedAt: new Date(),
        },
      });
    });
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
