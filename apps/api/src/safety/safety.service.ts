import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportBody } from '@manamap/shared';

@Injectable()
export class SafetyService {
  constructor(private readonly prisma: PrismaService) {}

  async getBlockedIds(userId: string): Promise<Set<string>> {
    const blocks = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });

    const ids = new Set<string>();
    for (const b of blocks) {
      ids.add(b.blockerId === userId ? b.blockedId : b.blockerId);
    }
    return ids;
  }

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });

    // Withdraw any pending or accepted connection between the two users
    await this.prisma.connection.deleteMany({
      where: {
        OR: [
          { requesterId: blockerId, addresseeId: blockedId },
          { requesterId: blockedId, addresseeId: blockerId },
        ],
      },
    });

    return { success: true };
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
    return { success: true };
  }

  async listBlocked(userId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      select: {
        id: true,
        blocked: { select: { id: true, displayName: true, avatarColors: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => ({
      id: b.id,
      userId: b.blocked.id,
      displayName: b.blocked.displayName,
      avatarColors: b.blocked.avatarColors,
    }));
  }

  async report(reporterId: string, dto: ReportBody) {
    if (reporterId === dto.userId) {
      throw new BadRequestException('Cannot report yourself');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');

    // TODO: admin moderation dashboard — reports are stored as OPEN for future review
    await this.prisma.report.create({
      data: {
        reporterId,
        reportedId: dto.userId,
        reason: dto.reason as ReportReason,
        detail: dto.detail ?? null,
        context: dto.context ?? null,
      },
    });

    return { success: true };
  }
}
