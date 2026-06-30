import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import {
  ConnectionStatus,
  EncounterResult,
  EncounterSource,
  ModerationStatus,
} from '@prisma/client';
import { REDIS } from '../redis/redis.module';
import type { PrismaService } from '../prisma/prisma.service';
import type { SafetyService } from '../safety/safety.service';
import type { SocialsService } from '../socials/socials.service';
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
  vibes: true,
  formats: true,
  tradeWants: true,
  tradeHaves: true,
} as const;

const FORMAT_LABELS: Record<string, string> = {
  standard: 'Standard',
  pioneer: 'Pioneer',
  modern: 'Modern',
  legacy: 'Legacy',
  vintage: 'Vintage',
  commander: 'Commander',
  draft: 'Draft',
};

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

const VIBE_LABELS: Record<string, string> = {
  competitive: 'Competitive',
  casual: 'Casual',
  spike: 'Spike',
  timmy: 'Timmy',
  johnny: 'Johnny',
  vorthos: 'Vorthos',
  influencer: 'Influencer',
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
    private readonly socialsService: SocialsService,
  ) {}

  private async _getPresence(callerId: string) {
    const storeId = await this.redis.get(presenceKey(callerId));
    if (!storeId)
      return { storeId: null as null, storeName: null as null, validIds: [] as string[] };

    const [store, memberIds] = await Promise.all([
      this.prisma.store.findUnique({ where: { id: storeId }, select: { name: true } }),
      this.redis.zrange(storeMembersKey(storeId), 0, -1),
    ]);

    const otherIds = memberIds.filter((id) => id !== callerId);
    if (!otherIds.length)
      return { storeId, storeName: store?.name ?? null, validIds: [] as string[] };

    const existsResults = await Promise.all(
      otherIds.map((id) => this.redis.exists(presenceKey(id))),
    );
    const validIds: string[] = [];
    const expiredIds: string[] = [];
    otherIds.forEach((id, i) => {
      if (existsResults[i]) validIds.push(id);
      else expiredIds.push(id);
    });

    if (expiredIds.length) await this.redis.zrem(storeMembersKey(storeId), ...expiredIds);

    return { storeId, storeName: store?.name ?? null, validIds };
  }

  private async _locationNearbyIds(
    callerId: string,
  ): Promise<{ lat: number; lng: number; ids: string[] }> {
    const RADIUS_METERS = 800;
    const STALENESS_MS = 15 * 60 * 1000;

    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { lastLat: true, lastLng: true, lastLocatedAt: true },
    });
    if (
      caller?.lastLat == null ||
      caller?.lastLng == null ||
      !caller.lastLocatedAt ||
      Date.now() - caller.lastLocatedAt.getTime() > STALENESS_MS
    ) {
      return { lat: 0, lng: 0, ids: [] };
    }

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT u.id FROM users u
      LEFT JOIN privacy_settings ps ON ps.user_id = u.id
      WHERE u.last_lat IS NOT NULL
        AND u.last_lng IS NOT NULL
        AND u.last_located_at > NOW() - INTERVAL '15 minutes'
        AND u.moderation_status = 'ACTIVE'
        AND u.id != ${callerId}
        AND (ps.discoverable IS NULL OR ps.discoverable = true)
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(u.last_lng, u.last_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${caller.lastLng}, ${caller.lastLat}), 4326)::geography,
          ${RADIUS_METERS}
        )
    `;

    return { lat: caller.lastLat, lng: caller.lastLng, ids: rows.map((r) => r.id) };
  }

  async nearby(callerId: string, filters?: NearbyFilters) {
    const [presenceData, blockedIds, callerPrivacy, { ids: locIds }] = await Promise.all([
      this._getPresence(callerId),
      this.safety.getBlockedIds(callerId),
      this.prisma.privacySettings.findUnique({
        where: { userId: callerId },
        select: { discoverable: true },
      }),
      this._locationNearbyIds(callerId),
    ]);
    const { storeId, storeName, validIds: storeMemberIds } = presenceData;

    // Always union location-based + store members; both sources contribute
    const allIds = [...new Set([...locIds, ...storeMemberIds])].filter((id) => !blockedIds.has(id));
    if (!allIds.length)
      return { storeId: storeId ?? null, storeName: storeName ?? null, players: [] };

    const windowStart = new Date(Date.now() - 60 * 60 * 1000);

    const [users, encounters, connections, upcomingEvents] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: allIds }, moderationStatus: ModerationStatus.ACTIVE },
        select: { ...PROFILE_SELECT, privacySettings: { select: { discoverable: true } } },
      }),
      this.prisma.encounter.findMany({
        where: {
          OR: [
            { userId: callerId, opponentId: { in: allIds } },
            { userId: { in: allIds }, opponentId: callerId },
          ],
        },
        select: {
          userId: true,
          opponentId: true,
          store: { select: { name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.connection.findMany({
        where: {
          status: ConnectionStatus.ACCEPTED,
          OR: [
            { requesterId: callerId, addresseeId: { in: allIds } },
            { requesterId: { in: allIds }, addresseeId: callerId },
          ],
        },
        select: { requesterId: true, addresseeId: true },
      }),
      storeId
        ? this.prisma.event.findMany({
            where: { storeId, startsAt: { gte: windowStart } },
            select: { id: true, name: true, startsAt: true },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    const metBeforeSet = new Set<string>();
    const lastMetStoreByPeer = new Map<string, string | null>();
    for (const e of encounters) {
      const peerId = e.userId === callerId ? e.opponentId : e.userId;
      metBeforeSet.add(peerId);
      if (!lastMetStoreByPeer.has(peerId)) {
        lastMetStoreByPeer.set(
          peerId,
          (e as { store?: { name: string } | null }).store?.name ?? null,
        );
      }
    }
    for (const c of connections) {
      metBeforeSet.add(c.requesterId === callerId ? c.addresseeId : c.requesterId);
    }

    // Events + shared-event lookup only apply to store co-presence
    const eventIds = upcomingEvents.map((e) => e.id);
    const eventMap = new Map(upcomingEvents.map((e) => [e.id, e]));

    const attendeeRecords =
      eventIds.length && storeId
        ? await this.prisma.eventAttendee.findMany({
            where: { eventId: { in: eventIds }, userId: { in: [callerId, ...storeMemberIds] } },
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

    const discoverableUsers = users.filter((u) => u.privacySettings?.discoverable !== false);
    const socialsBatch = await this.socialsService.publicSocialsBatch(
      discoverableUsers.map((u) => u.id),
    );

    let players = discoverableUsers.map(({ privacySettings: _ps, ...u }) => {
      const sd = socialsBatch.get(u.id) ?? { socials: [], friendsOnlyCount: 0 };
      return {
        ...u,
        pronouns: u.pronouns ?? null,
        bio: u.bio ?? null,
        commander: u.commander ?? null,
        powerLevel: u.powerLevel ?? null,
        vibes: u.vibes ?? [],
        metBefore: metBeforeSet.has(u.id),
        lastMetStoreName: lastMetStoreByPeer.get(u.id) ?? null,
        sharedEvent: storeId ? sharedEventFor(u.id) : null,
        socials: sd.socials,
        socialsSummary: { publicCount: sd.socials.length, friendsOnlyCount: sd.friendsOnlyCount },
      };
    });

    // Write PRESENCE encounters only for store co-presence (not location-only players)
    const callerDiscoverable = callerPrivacy?.discoverable !== false;
    const storeCoPresenceIds = storeMemberIds.filter((id) => !blockedIds.has(id));
    const discoverableStoreIds = discoverableUsers
      .filter((u) => storeCoPresenceIds.includes(u.id))
      .map((u) => u.id);

    if (storeId && callerDiscoverable && discoverableStoreIds.length > 0) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);

      const alreadyToday = await this.prisma.encounter.findMany({
        where: {
          source: EncounterSource.PRESENCE,
          storeId,
          createdAt: { gte: dayStart, lt: dayEnd },
          OR: [
            { userId: callerId, opponentId: { in: discoverableStoreIds } },
            { userId: { in: discoverableStoreIds }, opponentId: callerId },
          ],
        },
        select: { userId: true, opponentId: true },
      });

      const seenToday = new Set<string>();
      for (const e of alreadyToday) seenToday.add(e.userId === callerId ? e.opponentId : e.userId);

      const newIds = discoverableStoreIds.filter((id) => !seenToday.has(id));
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

    if (filters?.format)
      players = players.filter((p) => (p.formats as string[]).includes(filters.format!));
    if (filters?.colors?.length)
      players = players.filter((p) =>
        (p.avatarColors as string[]).some((c) => filters.colors!.includes(c)),
      );
    if (filters?.powerMin != null && !isNaN(filters.powerMin))
      players = players.filter((p) => p.powerLevel != null && p.powerLevel >= filters.powerMin!);
    if (filters?.powerMax != null && !isNaN(filters.powerMax))
      players = players.filter((p) => p.powerLevel != null && p.powerLevel <= filters.powerMax!);
    if (filters?.vibe) players = players.filter((p) => p.vibes.includes(filters.vibe!));

    return { storeId: storeId ?? null, storeName: storeName ?? null, players };
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
          userId: true,
          opponentId: true,
          source: true,
          result: true,
          store: { select: { name: true } },
          createdAt: true,
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
        lastMetStoreByPeer.set(
          peerId,
          (e as { store?: { name: string } | null }).store?.name ?? null,
        );
      }
      if (
        e.source === EncounterSource.GAME &&
        (e.result === EncounterResult.WIN || e.result === EncounterResult.DRAW)
      ) {
        positiveGamesByPeer.set(peerId, (positiveGamesByPeer.get(peerId) ?? 0) + 1);
      }
    }

    const eligiblePeers = peers.filter(
      (p) => p.privacySettings?.discoverable !== false && !connectedIds.has(p.id),
    );
    const suggSocialsBatch = await this.socialsService.publicSocialsBatch(
      eligiblePeers.map((p) => p.id),
    );

    const scored = eligiblePeers
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
        const callerVibes = callerUser.vibes as string[];
        const peerVibes = peer.vibes as string[];
        if (callerVibes.length > 0 && peerVibes.length > 0) {
          let bestCompat = 0;
          let bestPeerVibe = '';
          for (const cv of callerVibes) {
            for (const pv of peerVibes) {
              const compat = VIBE_COMPAT[cv]?.[pv] ?? 0;
              if (compat > bestCompat) {
                bestCompat = compat;
                bestPeerVibe = pv;
              }
              if (compat < 0 && bestCompat === 0) bestCompat = compat;
            }
          }
          if (bestCompat === 1) {
            score += SUGGESTION_WEIGHTS.vibeCompatible;
            reasons.push({
              type: 'compatible_vibe',
              label: `Compatible vibe (${VIBE_LABELS[bestPeerVibe] ?? bestPeerVibe})`,
            });
          } else if (bestCompat === -1) {
            score += SUGGESTION_WEIGHTS.vibeIncompatible;
          }
        }

        if (reasons.length === 0) {
          reasons.push({ type: 'new_connection', label: 'New player to meet' });
        }

        const sd = suggSocialsBatch.get(peer.id) ?? { socials: [], friendsOnlyCount: 0 };
        return {
          ...peer,
          pronouns: peer.pronouns ?? null,
          bio: peer.bio ?? null,
          commander: peer.commander ?? null,
          powerLevel: peer.powerLevel ?? null,
          vibes: peer.vibes ?? [],
          metBefore: metBeforeSet.has(peer.id),
          lastMetStoreName: lastMetStoreByPeer.get(peer.id) ?? null,
          sharedEvent: null,
          socials: sd.socials,
          socialsSummary: { publicCount: sd.socials.length, friendsOnlyCount: sd.friendsOnlyCount },
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
