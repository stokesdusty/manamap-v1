import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationKind } from '@prisma/client';
import { ConnectionStatus, GameStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { LfgService } from '../lfg/lfg.service';
import { PodsService } from '../pods/pods.service';
import { ConnectionsService } from '../connections/connections.service';
import { GamesService } from '../games/games.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BOT_IDS } from './dev.bots';

type BotRow = { id: string; displayName: string; formats: string[]; powerLevel: number | null };

@Injectable()
export class DevService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly lfg: LfgService,
    private readonly pods: PodsService,
    private readonly connections: ConnectionsService,
    private readonly games: GamesService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getBots(count: number, specificId?: string): Promise<BotRow[]> {
    const where = specificId ? { id: specificId, isBot: true } : { isBot: true };
    return this.prisma.user.findMany({
      where,
      take: count,
      select: { id: true, displayName: true, formats: true, powerLevel: true },
    });
  }

  private async resolveStoreId(callerId: string, storeId?: string): Promise<string> {
    if (storeId) return storeId;
    const fromPresence = await this.redis.get(`presence:${callerId}`);
    if (fromPresence) return fromPresence;
    const user = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { homeStoreId: true },
    });
    if (user?.homeStoreId) return user.homeStoreId;
    throw new BadRequestException('No store specified, not checked in, and no home store set');
  }

  async populateStore(callerId: string, storeId?: string, count = 4) {
    const effectiveStoreId = await this.resolveStoreId(callerId, storeId);
    const store = await this.prisma.store.findUnique({ where: { id: effectiveStoreId } });
    if (!store) throw new NotFoundException('Store not found');

    const bots = await this.getBots(Math.min(count, BOT_IDS.length));
    if (!bots.length) throw new NotFoundException('No bot accounts found — run db:seed first');

    for (const bot of bots) {
      await this.presence.heartbeat(bot.id, { storeId: effectiveStoreId });
    }

    const lfgBots = bots.slice(0, Math.ceil(bots.length / 2));
    let lfgOpen = 0;
    for (const bot of lfgBots) {
      try {
        await this.lfg.create(bot.id, {
          format:
            (bot.formats[0] as
              | 'standard'
              | 'pioneer'
              | 'modern'
              | 'legacy'
              | 'vintage'
              | 'commander'
              | 'draft') ?? null,
          power: bot.powerLevel ?? 6,
          seats: 2,
          durationMins: 60,
          note: null,
        });
        lfgOpen++;
      } catch {
        // Bot may already have a session — ignore
      }
    }

    return { storeId: effectiveStoreId, storeName: store.name, checkedIn: bots.length, lfgOpen };
  }

  async hostPod(callerId: string, storeId?: string) {
    const effectiveStoreId = await this.resolveStoreId(callerId, storeId);
    const [bot] = await this.getBots(1);
    if (!bot) throw new NotFoundException('No bot accounts found — run db:seed first');

    await this.presence.heartbeat(bot.id, { storeId: effectiveStoreId });

    // Disband any existing pod for this bot first
    const existingPodId = await this.redis.get(`user_pod:${bot.id}`);
    if (existingPodId) {
      try {
        await this.pods.disband(bot.id, existingPodId);
      } catch {
        // Pod may have expired
      }
    }

    const pod = await this.pods.create(bot.id, {
      format:
        (bot.formats[0] as
          | 'standard'
          | 'pioneer'
          | 'modern'
          | 'legacy'
          | 'vintage'
          | 'commander'
          | 'draft') ?? null,
      targetPower: bot.powerLevel ?? 6,
      tolerance: 2,
      seats: 4,
      where: 'Main table area',
      note: 'Bot pod — join to test',
    });

    return { podId: pod.id, hostId: bot.id, storeId: effectiveStoreId };
  }

  async requestMe(callerId: string, botId?: string) {
    const [bot] = await this.getBots(1, botId);
    if (!bot) throw new NotFoundException('Bot not found');

    const result = await this.connections.sendRequest(bot.id, { addresseeId: callerId });
    return { connectionId: result.id, fromBot: bot.id, fromName: bot.displayName };
  }

  async acceptMine(callerId: string) {
    const botIds = BOT_IDS as unknown as string[];
    const pending = await this.prisma.connection.findMany({
      where: {
        requesterId: callerId,
        addresseeId: { in: botIds },
        status: ConnectionStatus.PENDING,
      },
    });

    let accepted = 0;
    for (const conn of pending) {
      try {
        await this.connections.accept(conn.addresseeId, conn.id);
        accepted++;
      } catch {
        // Connection may have changed state — skip
      }
    }

    return { accepted };
  }

  async logGameWithMe(callerId: string, winnerId?: string) {
    const bots = await this.getBots(2);
    if (!bots.length) throw new NotFoundException('No bot accounts found — run db:seed first');

    const botIds = bots.map((b) => b.id);
    const playerIds = [callerId, ...botIds];
    const effectiveWinnerId = winnerId ?? callerId;

    if (!playerIds.includes(effectiveWinnerId)) {
      throw new BadRequestException('winnerId must be one of the players');
    }

    const game = await this.games.create(bots[0].id, {
      players: playerIds.map((id) => ({ userId: id })),
      winnerId: effectiveWinnerId,
      format:
        (bots[0].formats[0] as
          | 'standard'
          | 'pioneer'
          | 'modern'
          | 'legacy'
          | 'vintage'
          | 'commander'
          | 'draft') ?? undefined,
    });

    // Pre-confirm all bots so only the caller needs to confirm
    for (const bot of bots) {
      try {
        await this.games.confirm(bot.id, game.id);
      } catch {
        // Creator auto-confirmed already, or game already fully confirmed
      }
    }

    return { gameId: game.id, players: playerIds, winnerId: effectiveWinnerId };
  }

  async fullScene(callerId: string, storeId?: string) {
    const effectiveStoreId = await this.resolveStoreId(callerId, storeId);

    const populate = await this.populateStore(callerId, effectiveStoreId);
    const pod = await this.hostPod(callerId, effectiveStoreId);

    let connectionId: string | null = null;
    try {
      const conn = await this.requestMe(callerId);
      connectionId = conn.connectionId;
    } catch {
      // Connection may already exist
    }

    const game = await this.logGameWithMe(callerId);

    return {
      storeId: effectiveStoreId,
      checkedIn: populate.checkedIn,
      lfgOpen: populate.lfgOpen,
      podId: pod.podId,
      connectionId,
      gameId: game.gameId,
    };
  }

  async podForTracker(callerId: string, seats = 4) {
    const clampedSeats = Math.min(Math.max(2, seats), 4);
    const botCount = clampedSeats - 1;

    // Resolve store: presence → home store → first store in DB
    let storeId = await this.redis.get(`presence:${callerId}`);
    if (!storeId) {
      const user = await this.prisma.user.findUnique({
        where: { id: callerId },
        select: { homeStoreId: true },
      });
      storeId = user?.homeStoreId ?? null;
    }
    if (!storeId) {
      const anyStore = await this.prisma.store.findFirst({ select: { id: true } });
      if (!anyStore) throw new NotFoundException('No stores found — run db:seed first');
      storeId = anyStore.id;
    }

    // Ensure caller is checked in (heartbeat is idempotent)
    await this.presence.heartbeat(callerId, { storeId });

    // Disband any existing pod for caller to avoid already_hosting conflict
    const existingPodId = await this.redis.get(`user_pod:${callerId}`);
    if (existingPodId) {
      try {
        await this.pods.disband(callerId, existingPodId);
      } catch {
        /* expired */
      }
    }

    // Check in bots
    const bots = await this.getBots(botCount);
    if (!bots.length) throw new NotFoundException('No bot accounts found — run db:seed first');
    for (const bot of bots) {
      await this.presence.heartbeat(bot.id, { storeId });
    }

    // Create pod with caller as host (commander format)
    const pod = await this.pods.create(callerId, {
      format: 'commander',
      targetPower: 7,
      tolerance: 3,
      seats: clampedSeats,
      where: 'Life tracker test',
      note: 'Dev — bots pre-joined',
    });

    // Directly patch pod Redis state to add bots as full members, bypassing request flow
    const podRaw = await this.redis.get(`pod:${pod.id}`);
    if (podRaw) {
      const botIds = bots.map((b) => b.id);
      const ttl = Math.max(1, Math.ceil((new Date(pod.expiresAt).getTime() - Date.now()) / 1000));
      const patched = {
        ...(JSON.parse(podRaw) as Record<string, unknown>),
        memberIds: [...pod.memberIds, ...botIds],
        requestIds: [],
      };
      await this.redis.setex(`pod:${pod.id}`, ttl, JSON.stringify(patched));
      for (const botId of botIds) {
        await this.redis.setex(`user_pod:${botId}`, ttl, pod.id);
      }
    }

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true },
    });

    return {
      podId: pod.id,
      storeId,
      storeName: store?.name ?? storeId,
      memberCount: bots.length + 1,
      format: 'commander',
    };
  }

  async sendPlayInvite(callerId: string, platform: 'spelltable' | 'convoke') {
    const [bot] = await this.getBots(1);
    if (!bot) throw new NotFoundException('No bot accounts found — run db:seed first');

    const roomLink =
      platform === 'spelltable'
        ? 'https://spelltable.wizards.com/room/dev-test-abc123'
        : 'https://app.convoke.gg/room/dev-test-xyz789';

    const platformLabel = platform === 'spelltable' ? 'SpellTable' : 'Convoke';

    await this.notifications.create(callerId, {
      kind: 'PLAY_INVITE' as NotificationKind,
      title: `${bot.displayName} invited you to play`,
      body: `Join on ${platformLabel}: ${roomLink}`,
      data: { type: 'play_invite', platform, roomLink, inviterName: bot.displayName },
    });

    return { sent: true, platform, roomLink, fromBot: bot.displayName };
  }

  async populateNearby(callerId: string, count = 4) {
    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { lastLat: true, lastLng: true },
    });
    if (caller?.lastLat == null || caller?.lastLng == null) {
      throw new BadRequestException('No location on file — send a heartbeat with lat/lng first');
    }

    const bots = await this.getBots(Math.min(count, BOT_IDS.length));
    if (!bots.length) throw new NotFoundException('No bot accounts found — run db:seed first');

    // Remove any store presence so bots appear location-only (not checked in)
    for (const bot of bots) {
      const prevStoreId = await this.redis.get(`presence:${bot.id}`);
      if (prevStoreId) {
        await this.redis.zrem(`store_members:${prevStoreId}`, bot.id);
        await this.redis.del(`presence:${bot.id}`);
      }
    }

    // Scatter bots within ~300 m of caller (0.003° ≈ 333 m at equator)
    for (const bot of bots) {
      const latDelta = (Math.random() - 0.5) * 0.006;
      const lngDelta = (Math.random() - 0.5) * 0.006;
      await this.prisma.user.update({
        where: { id: bot.id },
        data: {
          lastLat: caller.lastLat + latDelta,
          lastLng: caller.lastLng + lngDelta,
          lastLocatedAt: new Date(),
        },
      });
    }

    return { populated: bots.length, lat: caller.lastLat, lng: caller.lastLng };
  }

  async reset(callerId: string) {
    const botIds = [...BOT_IDS] as string[];

    // Clear Redis presence, LFG, pods for each bot
    for (const botId of botIds) {
      // Presence
      const presenceStoreId = await this.redis.get(`presence:${botId}`);
      if (presenceStoreId) {
        await this.redis.zrem(`store_members:${presenceStoreId}`, botId);
      }
      await this.redis.del(`presence:${botId}`);

      // LFG
      const lfgRaw = await this.redis.get(`lfg:${botId}`);
      if (lfgRaw) {
        const session = JSON.parse(lfgRaw) as { storeId: string };
        await this.redis.zrem(`lfg_store:${session.storeId}`, botId);
        await this.redis.del(`lfg:${botId}`);
      }

      // Pods (bot as host)
      const podId = await this.redis.get(`user_pod:${botId}`);
      if (podId) {
        const podRaw = await this.redis.get(`pod:${podId}`);
        if (podRaw) {
          const pod = JSON.parse(podRaw) as { storeId: string };
          await this.redis.srem(`pod_store:${pod.storeId}`, podId);
        }
        await this.redis.del(`pod:${podId}`);
        await this.redis.del(`user_pod:${botId}`);
      }
    }

    // Expire bot location data so they don't linger in location-based nearby
    await this.prisma.user.updateMany({
      where: { id: { in: botIds } },
      data: { lastLocatedAt: new Date(0) },
    });

    // Delete PENDING connections between bots and the caller
    await this.prisma.connection.deleteMany({
      where: {
        OR: [
          { requesterId: { in: botIds }, addresseeId: callerId, status: ConnectionStatus.PENDING },
          { requesterId: callerId, addresseeId: { in: botIds }, status: ConnectionStatus.PENDING },
        ],
      },
    });

    // Delete PENDING game logs created by bots where caller is a player
    const pendingGames = await this.prisma.gameLog.findMany({
      where: {
        status: GameStatus.PENDING,
        createdById: { in: botIds },
        players: { some: { userId: callerId } },
      },
      select: { id: true },
    });

    if (pendingGames.length) {
      await this.prisma.gameLog.deleteMany({
        where: { id: { in: pendingGames.map((g) => g.id) } },
      });
    }

    return { success: true, clearedGames: pendingGames.length };
  }
}
