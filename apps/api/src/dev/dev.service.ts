import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionStatus, GameStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { LfgService } from '../lfg/lfg.service';
import { PodsService } from '../pods/pods.service';
import { ConnectionsService } from '../connections/connections.service';
import { GamesService } from '../games/games.service';
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
  ) {}

  private async getBots(count: number, specificId?: string): Promise<BotRow[]> {
    const where = specificId
      ? { id: specificId, isBot: true }
      : { isBot: true };
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
      await this.presence.heartbeat(bot.id, effectiveStoreId);
    }

    const lfgBots = bots.slice(0, Math.ceil(bots.length / 2));
    let lfgOpen = 0;
    for (const bot of lfgBots) {
      try {
        await this.lfg.create(bot.id, {
          format: (bot.formats[0] as 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'commander' | 'draft') ?? null,
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

    await this.presence.heartbeat(bot.id, effectiveStoreId);

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
      format: (bot.formats[0] as 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'commander' | 'draft') ?? null,
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
      format: (bots[0].formats[0] as 'standard' | 'pioneer' | 'modern' | 'legacy' | 'vintage' | 'commander' | 'draft') ?? undefined,
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
