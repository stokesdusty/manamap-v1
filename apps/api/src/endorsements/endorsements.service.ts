import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GameStatus, ModerationStatus } from '@prisma/client';
import type { EndorseInput, EndorsementSummary } from '@manamap/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';

@Injectable()
export class EndorsementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
  ) {}

  async endorse(fromUserId: string, gameLogId: string, dto: EndorseInput) {
    if (fromUserId === dto.toUserId) {
      throw new BadRequestException('cannot_endorse_self');
    }

    const game = await this.prisma.gameLog.findUnique({
      where: { id: gameLogId },
      include: { players: true },
    });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== GameStatus.CONFIRMED) {
      throw new BadRequestException('game_not_confirmed');
    }

    const fromPlayer = game.players.find((p) => p.userId === fromUserId && p.confirmed);
    if (!fromPlayer) throw new ForbiddenException('not_in_game');

    const toPlayer = game.players.find((p) => p.userId === dto.toUserId && p.confirmed);
    if (!toPlayer) throw new BadRequestException('target_not_in_game');

    const blockedIds = await this.safety.getBlockedIds(fromUserId);
    if (blockedIds.has(dto.toUserId)) {
      throw new ForbiddenException('blocked');
    }

    await this.prisma.endorsement.upsert({
      where: {
        fromUserId_toUserId_gameLogId: {
          fromUserId,
          toUserId: dto.toUserId,
          gameLogId,
        },
      },
      create: { fromUserId, toUserId: dto.toUserId, gameLogId, tag: dto.tag },
      update: { tag: dto.tag },
    });

    return { success: true };
  }

  async getSummary(targetUserId: string): Promise<EndorsementSummary> {
    const blockedIds = await this.safety.getBlockedIds(targetUserId);

    const rows = await this.prisma.endorsement.groupBy({
      by: ['tag'],
      where: {
        toUserId: targetUserId,
        ...(blockedIds.size ? { fromUserId: { notIn: Array.from(blockedIds) } } : {}),
        fromUser: { moderationStatus: ModerationStatus.ACTIVE },
      },
      _count: { _all: true },
    });

    const byTag = rows.map((r) => ({ tag: r.tag, count: r._count._all }));
    const total = byTag.reduce((sum, r) => sum + r.count, 0);
    return { total, byTag };
  }
}
