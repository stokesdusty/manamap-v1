import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { ConnectionStatus, EncounterResult, EncounterSource } from '@prisma/client';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async nearby(callerId: string) {
    const storeId = await this.redis.get(presenceKey(callerId));
    if (!storeId) {
      return { storeId: null, storeName: null, players: [] };
    }

    const [store, memberIds] = await Promise.all([
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: { name: true },
      }),
      this.redis.zrange(storeMembersKey(storeId), 0, -1),
    ]);

    const otherIds = memberIds.filter((id) => id !== callerId);
    if (!otherIds.length) {
      return { storeId, storeName: store?.name ?? null, players: [] };
    }

    // Check which members still have a live presence key (not expired)
    const existsResults = await Promise.all(
      otherIds.map((id) => this.redis.exists(presenceKey(id))),
    );

    const validIds: string[] = [];
    const expiredIds: string[] = [];
    otherIds.forEach((id, i) => {
      if (existsResults[i]) {
        validIds.push(id);
      } else {
        expiredIds.push(id);
      }
    });

    // Lazy cleanup of expired members from the sorted set
    if (expiredIds.length) {
      await this.redis.zrem(storeMembersKey(storeId), ...expiredIds);
    }

    if (!validIds.length) {
      return { storeId, storeName: store?.name ?? null, players: [] };
    }

    const windowStart = new Date(Date.now() - 60 * 60 * 1000); // events started up to 1h ago

    // Fetch profiles, privacy settings, met-before data, and shared-event data in parallel
    const [users, encounters, connections, upcomingEvents] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: validIds } },
        select: {
          ...PROFILE_SELECT,
          privacySettings: { select: { discoverable: true } },
        },
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
          store: { select: { name: true } },
          createdAt: true,
        },
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

    // Build the "met before" set + most-recent store name per peer
    const metBeforeSet = new Set<string>();
    const lastMetStoreByPeer = new Map<string, string | null>();
    for (const e of encounters) {
      const peerId = e.userId === callerId ? e.opponentId : e.userId;
      metBeforeSet.add(peerId);
      if (!lastMetStoreByPeer.has(peerId)) {
        // encounters ordered desc so first = most recent
        lastMetStoreByPeer.set(peerId, (e as { store?: { name: string } | null }).store?.name ?? null);
      }
    }
    for (const c of connections) {
      metBeforeSet.add(c.requesterId === callerId ? c.addresseeId : c.requesterId);
    }

    // Build shared-event lookup
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

    const players = users
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

    // Write co-presence PRESENCE encounters (once per store per day, discoverable only)
    const discoverableIds = players.map((p) => p.id);
    if (discoverableIds.length > 0) {
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
      for (const e of alreadyToday) {
        seenToday.add(e.userId === callerId ? e.opponentId : e.userId);
      }

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

    return { storeId, storeName: store?.name ?? null, players };
  }
}
