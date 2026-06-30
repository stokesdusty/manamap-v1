import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EncounterResult,
  EncounterSource,
  GameStatus,
  ModerationStatus,
  NotificationKind,
} from '@prisma/client';
import type { CreateGame } from '@manamap/shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { SafetyService } from '../safety/safety.service';
import type { GamificationService } from '../gamification/gamification.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { QuestsService } from '../quests/quests.service';

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
    private readonly quests: QuestsService,
  ) {}

  private async fetchGame(gameId: string) {
    return this.prisma.gameLog.findUnique({
      where: { id: gameId },
      include: {
        store: { select: { id: true, name: true } },
        winner: { select: { id: true, displayName: true } },
        players: {
          include: {
            user: { select: { id: true, displayName: true, avatarColors: true } },
          },
        },
      },
    });
  }

  private shape(g: NonNullable<Awaited<ReturnType<GamesService['fetchGame']>>>) {
    return {
      id: g.id,
      status: g.status,
      storeId: g.storeId,
      storeName: g.store?.name ?? null,
      format: g.format,
      winnerId: g.winnerId,
      winnerName: g.winner.displayName,
      note: g.note,
      players: g.players.map((p) => ({
        userId: p.userId,
        displayName: p.user.displayName,
        avatarColors: p.user.avatarColors,
        deck: p.deck,
        confirmed: p.confirmed,
      })),
      createdAt: g.createdAt.toISOString(),
      confirmedAt: g.confirmedAt?.toISOString() ?? null,
    };
  }

  async create(creatorId: string, dto: CreateGame) {
    const playerIds = dto.players.map((p) => p.userId);

    if (!playerIds.includes(creatorId)) {
      throw new BadRequestException('creator_not_in_roster');
    }
    if (!playerIds.includes(dto.winnerId)) {
      throw new BadRequestException('winner_not_in_roster');
    }
    if (new Set(playerIds).size !== playerIds.length) {
      throw new BadRequestException('duplicate_players');
    }

    const blockedIds = await this.safety.getBlockedIds(creatorId);

    const users = await this.prisma.user.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, displayName: true, moderationStatus: true },
    });

    if (users.length !== playerIds.length) {
      throw new BadRequestException('invalid_players');
    }

    for (const u of users) {
      if (u.id === creatorId) continue;
      if (blockedIds.has(u.id)) throw new BadRequestException('blocked_player');
      if (u.moderationStatus !== ModerationStatus.ACTIVE) {
        throw new BadRequestException('inactive_player');
      }
    }

    const gl = await this.prisma.$transaction(async (tx) => {
      const log = await tx.gameLog.create({
        data: {
          createdById: creatorId,
          storeId: dto.storeId ?? null,
          format: dto.format ?? null,
          winnerId: dto.winnerId,
          note: dto.note ?? null,
        },
      });
      await tx.gamePlayer.createMany({
        data: dto.players.map((p) => ({
          gameLogId: log.id,
          userId: p.userId,
          deck: p.deck ?? null,
          confirmed: p.userId === creatorId,
        })),
      });
      return log;
    });

    const creator = users.find((u) => u.id === creatorId);
    for (const id of playerIds.filter((id) => id !== creatorId)) {
      void this.notifications.create(id, {
        kind: NotificationKind.GAME_CONFIRM,
        title: `${creator?.displayName ?? 'Someone'} logged a game`,
        body: 'Confirm the result',
        data: { type: 'game_confirm', gameId: gl.id },
      });
    }

    const game = await this.fetchGame(gl.id);
    return this.shape(game!);
  }

  async confirm(callerId: string, gameId: string) {
    const game = await this.prisma.gameLog.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== GameStatus.PENDING) throw new BadRequestException('game_not_pending');

    const playerRow = game.players.find((p) => p.userId === callerId);
    if (!playerRow) throw new ForbiddenException('not_in_game');

    await this.prisma.gamePlayer.update({
      where: { id: playerRow.id },
      data: { confirmed: true },
    });

    const updatedPlayers = game.players.map((p) =>
      p.userId === callerId ? { ...p, confirmed: true } : p,
    );
    const allConfirmed = updatedPlayers.every((p) => p.confirmed);

    if (allConfirmed) {
      const loserIds = game.players.map((p) => p.userId).filter((id) => id !== game.winnerId);

      const encounterData = loserIds.flatMap((loserId) => [
        {
          userId: game.winnerId,
          opponentId: loserId,
          storeId: game.storeId,
          source: EncounterSource.GAME,
          result: EncounterResult.WIN,
          gameId,
          notes: 'Confirmed game result',
        },
        {
          userId: loserId,
          opponentId: game.winnerId,
          storeId: game.storeId,
          source: EncounterSource.GAME,
          result: EncounterResult.LOSS,
          gameId,
          notes: 'Confirmed game result',
        },
      ]);

      await this.prisma.$transaction([
        this.prisma.gameLog.update({
          where: { id: gameId },
          data: { status: GameStatus.CONFIRMED, confirmedAt: new Date() },
        }),
        this.prisma.encounter.createMany({ data: encounterData, skipDuplicates: true }),
      ]);

      if (game.storeId) {
        void this.gamification.refreshWinsLeaderboard(game.storeId);
      }

      for (const p of game.players) {
        void this.quests.evaluate(p.userId);
      }
    }

    return { success: true, allConfirmed };
  }

  async dispute(callerId: string, gameId: string) {
    const game = await this.prisma.gameLog.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== GameStatus.PENDING) throw new BadRequestException('game_not_pending');

    const playerRow = game.players.find((p) => p.userId === callerId);
    if (!playerRow) throw new ForbiddenException('not_in_game');

    await this.prisma.gameLog.update({
      where: { id: gameId },
      data: { status: GameStatus.DISPUTED },
    });

    if (game.createdById !== callerId) {
      void this.notifications.create(game.createdById, {
        kind: NotificationKind.GAME_CONFIRM,
        title: 'Game result disputed',
        body: 'A player disputed your logged game',
        data: { type: 'game_disputed', gameId },
      });
    }

    return { success: true };
  }

  async getPending(callerId: string) {
    const games = await this.prisma.gameLog.findMany({
      where: {
        status: GameStatus.PENDING,
        players: { some: { userId: callerId, confirmed: false } },
      },
      include: {
        store: { select: { id: true, name: true } },
        winner: { select: { id: true, displayName: true } },
        players: {
          include: {
            user: { select: { id: true, displayName: true, avatarColors: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return games.map((g) => this.shape(g));
  }

  async getMyGames(callerId: string, limit = 20) {
    const games = await this.prisma.gameLog.findMany({
      where: {
        status: GameStatus.CONFIRMED,
        players: { some: { userId: callerId } },
      },
      include: {
        store: { select: { id: true, name: true } },
        winner: { select: { id: true, displayName: true } },
        players: {
          include: {
            user: { select: { id: true, displayName: true, avatarColors: true } },
          },
        },
      },
      orderBy: { confirmedAt: 'desc' },
      take: Math.min(limit, 50),
    });
    return games.map((g) => this.shape(g));
  }
}
