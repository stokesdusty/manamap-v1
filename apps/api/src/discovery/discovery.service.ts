import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { ConnectionStatus, EncounterResult, EncounterSource, ModerationStatus } from '@prisma/client';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { SUGGESTION_WEIGHTS, VIBE_COMPAT } from './suggestion-weights';

const presenceKey = (userId: string) => `presence:${userId}`;
const storeMembersKey = (storeId: string) => `store_members:${storeId}`;

const PROFILE_SELECT = {
  id: true,
  displayName: true,
  pronouns: true,
  bio: true,
  avatarColors: true,
  commander: true,
  powerLevel: true,
  vibe: true,
  formats: true,
} as const;

const FORMAT_LABELS: Record<string, string> = {
  standard: 'Standard', pioneer: 'Pioneer', modern: 'Modern',
  legacy: 'Legacy', vintage: 'Vintage', commander: 'Commander', draft: 'Draft',
};

const COLOR_NAMES: Record<string, string> = {
  W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green',
};

const VIBE_LABELS: Record<string, string> = {
  competitive: 'Competitive', casual: 'Casual', spike: 'Spike',
  timmy: 'Timmy', johnny: 'Johnny', vorthos: 'Vorthos',
};

const MAX_SUGGESTIONS = 5;

export interface NearbyFilters {
  format?: string;
  colors?: string[];
  powerMin?: number;
  powerMax?: number;
  vibe?: string;
}

@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
  ) {}

  private async _getPresence(callerId: string) {
    const storeId = await this.redis.get(presenceKey(callerId));
    if (!storeId) return { storeId: null as null, storeName: null as null, validIds: [] as string[] };

    const [store, memberIds] = await Promise.all([
      this.prisma.store.findUnique({ where: { id: storeId }, select: { name: true } }),
      this.redis.zrange(storeMembersKey(storeId), 0, -1),
    ]);

    const otherIds = memberIds.filter((id) => id !== callerId);
    if (!otherIds.length) return { storeId, storeName: store?.name ?? null, validIds: [] as string[] };

    const existsResults = await Promise.all(otherIds.map((id) => this.redis.exists(presenceKey(id))));
    const validIds: string[] = [];
    const expiredIds: string[] = [];
    otherIds.forEach((id, i) => {
      if (existsResults[i]) validIds.push(id);
      else expiredIds.push(id);
    });

    if (expiredIds.length) await this.redis.zrem(storeMembersKey(storeId), ...expiredIds);

    return { storeId, storeName: store?.name ?? null, validIds };
  }

  async nearby(callerId: string, filters?: NearbyFilters) {
    const [presenceData, blockedIds, callerPrivacy] = await Promise.all([
      this._getPresence(callerId),
      this.safety.getBlockedIds(callerId),
      this.prisma.privacySettings.findUnique({
        where: { userId: callerId },
        select: { discoverable: true },
      }),
    ]);
    const { storeId, storeName, validIds: rawValidIds } = presenceData;
    if (!storeId) return { storeId: null, storeName: null, players: [] };

    const validIds = rawValidIds.filter((id) => !blockedIds.has(id));
    if (!validIds.length) return { storeId, storeName, players: [] };

    const windowStart = new Date(Date.now() - 60 * 60 * 1000);

    const [users, encounters, connections, upcomingEvents] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: validIds }, moderationStatus: ModerationStatus.ACTIVE },
        select: { ...PROFILE_SELECT, privacySettings: { select: { discoverable: true } } },
      }),
      this.prisma.encounter.findMany({
        where: {
          OR: [
            { userId: callerId, opponentId: { in: validIds } },
            { userId: { in: validIds }, opponentId: callerId },
          ],
        },
        select: { userId: true, opponentId: true, store: { select: { name: true } }, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.connection.findMany({
        where: {
          status: ConnectionStatus.ACCEPTED,
          OR: [
            { requesterId: callerId, addresseeId: { in: validIds } },
            { requesterId: { in: validIds }, addresseeId: callerId },
          ],
        },
        select: { requesterId: true, addresseeId: true },
      }),
      this.prisma.event.findMany({
        where: { storeId, startsAt: { gte: windowStart } },
        select: { id: true, name: true, startsAt: true },
        take: 20,
      }),
    ]);

    const metBeforeSet = new Set<string>();
    const lastMetStoreByPeer = new Map<string, string | null>();
    for (const e of encounters) {
      const peerId = e.userId === callerId ? e.opponentId : e.userId;
      metBeforeSet.add(peerId);
      if (!lastMetStoreByPeer.has(peerId)) {
        lastMetStoreByPeer.set(peerId, (e as { store?: { name: string } | null }).store?.name ?? null);
      }
    }
    for (const c of connections) {
      metBeforeSet.add(c.requesterId === callerId ? c.addresseeId : c.requesterId);
    }

    const eventIds = upcomingEvents.map((e) => e.id);
    const eventMap = new Map(upcomingEvents.map((e) => [e.id, e]));

    const attendeeRecords = eventIds.length
      ? await this.prisma.eventAttendee.findMany({
          where: { eventId: { in: eventIds }, userId: { in: [callerId, ...validIds] } },
          select: { userId: true, eventId: true },
        })
      : [];

    const attendeeByUser = new Map<string, Set<string>>();
    for (const a of attendeeRecords) {
      if (!attendeeByUser.has(a.userId)) attendeeByUser.set(a.userId, new Set());
      attendeeByUser.get(a.userId)!.add(a.eventId);
    }
    const callerEvents = attendeeByUser.get(callerId) ?? new Set<string>();

    function sharedEventFor(playerId: string) {
      const playerEvents = attendeeByUser.get(playerId) ?? new Set<string>();
      for (const eid of callerEvents) {
        if (playerEvents.has(eid)) {
          const evt = eventMap.get(eid)!;
          return { id: evt.id, name: evt.name, startsAt: evt.startsAt.toISOString() };
        }
      }
      return null;
    }

    let players = users
      .filter((u) => u.privacySettings?.discoverable !== false)
      .map(({ privacySettings: _ps, ...u }) => ({
        ...u,
        pronouns: u.pronouns ?? null,
        bio: u.bio ?? null,
        commander: u.commander ?? null,
        powerLevel: u.powerLevel ?? null,
        vibe: u.vibe ?? null,
        metBefore: metBeforeSet.has(u.id),
        lastMetStoreName: lastMetStoreByPeer.get(u.id) ?? null,
        sharedEvent: sharedEventFor(u.id),
      }));

    // Write PRESENCE encounters only when caller is discoverable (invisible = no co-presence record)
    const callerDiscoverable = callerPrivacy?.discoverable !== false;
    const discoverableIds = players.map((p) => p.id);
    if (callerDiscoverable && discoverableIds.length > 0) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);

      const alreadyToday = await this.prisma.encounter.findMany({
        where: {
          source: EncounterSource.PRESENCE,
          storeId,
          createdAt: { gte: dayStart, lt: dayEnd },
          OR: [
            { userId: callerId, opponentId: { in: discoverableIds } },
            { userId: { in: discoverableIds }, opponentId: callerId },
          ],
        },
        select: { userId: true, opponentId: true },
      });

      const seenToday = new Set<string>();
      for (const e of alreadyToday) seenToday.add(e.userId === callerId ? e.opponentId : e.userId);

      const newIds = discoverableIds.filter((id) => !seenToday.has(id));
      if (newIds.length > 0) {
        await this.prisma.encounter.createMany({
          data: newIds.map((opponentId) => ({
            userId: callerId,
            opponentId,
            storeId,
            source: EncounterSource.PRESENCE,
            result: EncounterResult.DRAW,
            notes: 'Co-present at store',
          })),
        });
      }
    }

    // Apply filters
    if (filters?.format) {
      players = players.filter((p) => (p.formats as string[]).includes(filters.format!));
    }
    if (filters?.colors?.length) {
      players = players.filter((p) =>
        (p.avatarColors as string[]).some((c) => filters.colors!.includes(c)),
      );
    }
    if (filters?.powerMin != null && !isNaN(filters.powerMin)) {
      players = players.filter((p) => p.powerLevel != null && p.powerLevel >= filters.powerMin!);
    }
    if (filters?.powerMax != null && !isNaN(filters.powerMax)) {
      players = players.filter((p) => p.powerLevel != null && p.powerLevel <= filters.powerMax!);
    }
    if (filters?.vibe) {
      players = players.filter((p) => p.vibe === filters.vibe);
    }

    return { storeId, storeName, players };
  }

  async suggestions(callerId: string) {
    const [presenceData, blockedIds] = await Promise.all([
      this._getPresence(callerId),
      this.safety.getBlockedIds(callerId),
    ]);
    const { storeId, storeName, validIds: rawValidIds } = presenceData;
    if (!storeId || !rawValidIds.length) {
      return { storeId: storeId ?? null, storeName: storeName ?? null, suggestions: [] };
    }

    const validIds = rawValidIds.filter((id) => !blockedIds.has(id));
    if (!validIds.length) {
      return { storeId, storeName, suggestions: [] };
    }

    const [callerUser, peers, encounters, connections] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: callerId }, select: PROFILE_SELECT }),
      this.prisma.user.findMany({
        where: { id: { in: validIds }, moderationStatus: ModerationStatus.ACTIVE },
        select: { ...PROFILE_SELECT, privacySettings: { select: { discoverable: true } } },
      }),
      this.prisma.encounter.findMany({
        where: {
          OR: [
            { userId: callerId, opponentId: { in: validIds } },
            { userId: { in: validIds }, opponentId: callerId },
          ],
        },
        select: {
          userId: true, opponentId: true,
          source: true, result: true,
          store: { select: { name: true } }, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.connection.findMany({
        where: {
          OR: [
            { requesterId: callerId, addresseeId: { in: validIds } },
            { requesterId: { in: validIds }, addresseeId: callerId },
          ],
        },
        select: { requesterId: true, addresseeId: true },
      }),
    ]);

    if (!callerUser) return { storeId, storeName, suggestions: [] };

    // Any connection (pending/accepted/blocked) → exclude from suggestions
    const connectedIds = new Set<string>(
      connections.map((c) => (c.requesterId === callerId ? c.addresseeId : c.requesterId)),
    );

    const metBeforeSet = new Set<string>();
    const lastMetStoreByPeer = new Map<string, string | null>();
    const positiveGamesByPeer = new Map<string, number>();

    for (const e of encounters) {
      const peerId = e.userId === callerId ? e.opponentId : e.userId;
      metBeforeSet.add(peerId);
      if (!lastMetStoreByPeer.has(peerId)) {
        lastMetStoreByPeer.set(peerId, (e as { store?: { name: string } | null }).store?.name ?? null);
      }
      if (
        e.source === EncounterSource.GAME &&
        (e.result === EncounterResult.WIN || e.result === EncounterResult.DRAW)
      ) {
        positiveGamesByPeer.set(peerId, (positiveGamesByPeer.get(peerId) ?? 0) + 1);
      }
    }

    const scored = peers
      .filter((p) => p.privacySettings?.discoverable !== false && !connectedIds.has(p.id))
      .map(({ privacySettings: _ps, ...peer }) => {
        let score = 0;
        const reasons: Array<{ type: string; label: string }> = [];

        // Shared formats
        const sharedFormats = (callerUser.formats as string[]).filter((f) =>
          (peer.formats as string[]).includes(f),
        );
        if (sharedFormats.length > 0) {
          score += SUGGESTION_WEIGHTS.sharedFormat * sharedFormats.length;
          reasons.push({
            type: 'shared_format',
            label: `Also plays ${sharedFormats.map((f) => FORMAT_LABELS[f] ?? f).join(', ')}`,
          });
        }

        // Power level compatibility
        const callerPower = callerUser.powerLevel as number | null;
        const peerPower = peer.powerLevel as number | null;
        if (callerPower != null && peerPower != null) {
          const diff = Math.abs(callerPower - peerPower);
          if (diff === 0) {
            score += SUGGESTION_WEIGHTS.powerLevelExact;
            reasons.push({ type: 'similar_power', label: `Same power level (P${peerPower})` });
          } else if (diff <= 2) {
            score += SUGGESTION_WEIGHTS.powerLevelClose;
            reasons.push({ type: 'similar_power', label: `Similar power level (P${peerPower})` });
          }
        }

        // Color identity overlap
        const sharedColors = (callerUser.avatarColors as string[]).filter((c) =>
          (peer.avatarColors as string[]).includes(c),
        );
        if (sharedColors.length > 0) {
          score += SUGGESTION_WEIGHTS.colorOverlapPerColor * sharedColors.length;
          reasons.push({
            type: 'color_overlap',
            label: `Shares ${sharedColors.map((c) => COLOR_NAMES[c] ?? c).join(', ')}`,
          });
        }

        // Positive past GAME encounters
        const positiveCount = positiveGamesByPeer.get(peer.id) ?? 0;
        if (positiveCount > 0) {
          score += SUGGESTION_WEIGHTS.positiveEncounterBonus * Math.min(positiveCount, 3);
          reasons.push({ type: 'positive_encounter', label: "You've played together before" });
        }

        // Vibe compatibility
        const callerVibe = callerUser.vibe as string | null;
        const peerVibe = peer.vibe as string | null;
        if (callerVibe && peerVibe) {
          const compat = VIBE_COMPAT[callerVibe]?.[peerVibe] ?? 0;
          if (compat === 1) {
            score += SUGGESTION_WEIGHTS.vibeCompatible;
            reasons.push({
              type: 'compatible_vibe',
              label: `Compatible vibe (${VIBE_LABELS[peerVibe] ?? peerVibe})`,
            });
          } else if (compat === -1) {
            score += SUGGESTION_WEIGHTS.vibeIncompatible;
          }
        }

        if (reasons.length === 0) {
          reasons.push({ type: 'new_connection', label: 'New player to meet' });
        }

        return {
          ...peer,
          pronouns: peer.pronouns ?? null,
          bio: peer.bio ?? null,
          commander: peer.commander ?? null,
          powerLevel: peer.powerLevel ?? null,
          vibe: peer.vibe ?? null,
          metBefore: metBeforeSet.has(peer.id),
          lastMetStoreName: lastMetStoreByPeer.get(peer.id) ?? null,
          sharedEvent: null,
          score,
          reasons,
        };
      })
      .filter((p) => p.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS);

    return { storeId, storeName, suggestions: scored };
  }
}
