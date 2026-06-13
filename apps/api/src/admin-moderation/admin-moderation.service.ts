import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import { ConnectionStatus, ModerationActionType, ModerationStatus, ReportStatus } from '@prisma/client';
import type { ResolveReport } from '@manamap/shared';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminModerationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async getStats() {
    const [open, reviewed, actionedAllTime] = await Promise.all([
      this.prisma.report.count({ where: { status: ReportStatus.OPEN } }),
      this.prisma.report.count({ where: { status: ReportStatus.REVIEWED } }),
      this.prisma.report.count({ where: { status: ReportStatus.ACTIONED } }),
    ]);

    const openReports = await this.prisma.report.findMany({
      where: { status: ReportStatus.OPEN },
      select: { reportedId: true },
    });
    const uniqueIds = [...new Set(openReports.map((r) => r.reportedId))];

    let repeatOffenders = 0;
    if (uniqueIds.length > 0) {
      const counts = await this.prisma.report.groupBy({
        by: ['reportedId'],
        where: { reportedId: { in: uniqueIds } },
        _count: { id: true },
      });
      repeatOffenders = counts.filter((c) => c._count.id >= 3).length;
    }

    return { open, repeatOffenders, reviewed, actionedAllTime };
  }

  async listReports(status: 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'ALL') {
    const where = status === 'ALL' ? {} : { status: status as ReportStatus };
    const reports = await this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reason: true,
        context: true,
        createdAt: true,
        status: true,
        resolvedAt: true,
        resolutionNote: true,
        reported: {
          select: {
            id: true,
            displayName: true,
            avatarColors: true,
            moderationStatus: true,
            identities: { select: { discordHandle: true }, take: 1 },
            reportsAgainst: { select: { id: true } },
            targetedActions: { select: { id: true } },
          },
        },
      },
    });

    return reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      context: r.context ?? null,
      createdAt: r.createdAt.toISOString(),
      status: r.status,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      resolutionNote: r.resolutionNote ?? null,
      reported: {
        id: r.reported.id,
        displayName: r.reported.displayName,
        handle: r.reported.identities[0]?.discordHandle ?? null,
        avatarColors: r.reported.avatarColors,
        moderationStatus: r.reported.moderationStatus,
        priorReports: r.reported.reportsAgainst.length,
        priorActions: r.reported.targetedActions.length,
      },
    }));
  }

  async getReport(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        reason: true,
        detail: true,
        context: true,
        createdAt: true,
        status: true,
        resolvedAt: true,
        resolutionNote: true,
        reported: {
          select: {
            id: true,
            displayName: true,
            avatarColors: true,
            moderationStatus: true,
            identities: { select: { discordHandle: true }, take: 1 },
            reportsAgainst: { select: { id: true } },
            targetedActions: {
              select: { id: true, action: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found');

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const openThisWeek = await this.prisma.report.findMany({
      where: {
        reportedId: report.reported.id,
        status: ReportStatus.OPEN,
        id: { not: id },
        createdAt: { gte: weekAgo },
      },
      select: { id: true, reason: true, createdAt: true },
    });

    const signals = [
      ...openThisWeek.map((r) => ({
        type: 'open_report' as const,
        label: `Open ${r.reason.toLowerCase().replace('_', ' ')} report this week`,
        createdAt: r.createdAt.toISOString(),
      })),
      ...report.reported.targetedActions.map((a) => ({
        type: 'prior_action' as const,
        label: `${a.action.charAt(0) + a.action.slice(1).toLowerCase()} action taken`,
        createdAt: a.createdAt.toISOString(),
      })),
    ];

    return {
      id: report.id,
      reason: report.reason,
      detail: report.detail ?? null,
      context: report.context ?? null,
      createdAt: report.createdAt.toISOString(),
      status: report.status,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      resolutionNote: report.resolutionNote ?? null,
      reported: {
        id: report.reported.id,
        displayName: report.reported.displayName,
        handle: report.reported.identities[0]?.discordHandle ?? null,
        avatarColors: report.reported.avatarColors,
        moderationStatus: report.reported.moderationStatus,
        priorReports: report.reported.reportsAgainst.length,
        priorActions: report.reported.targetedActions.length,
      },
      signals,
    };
  }

  async resolveReport(reportId: string, adminId: string, dto: ResolveReport) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, reportedId: true, status: true },
    });
    if (!report) throw new NotFoundException('Report not found');

    const newStatus =
      dto.action === 'DISMISS' ? ReportStatus.REVIEWED : ReportStatus.ACTIONED;

    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: newStatus,
          resolvedById: adminId,
          resolvedAt: new Date(),
          ...(dto.note !== undefined ? { resolutionNote: dto.note } : {}),
        },
      });

      await tx.moderationAction.create({
        data: {
          reportId,
          targetUserId: report.reportedId,
          adminId,
          action: dto.action as ModerationActionType,
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
      });

      if (dto.action === 'SUSPEND') {
        const days = dto.suspendDays ?? 7;
        const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await tx.user.update({
          where: { id: report.reportedId },
          data: { moderationStatus: ModerationStatus.SUSPENDED, suspendedUntil },
        });
      } else if (dto.action === 'BAN') {
        await tx.user.update({
          where: { id: report.reportedId },
          data: { moderationStatus: ModerationStatus.BANNED, suspendedUntil: null },
        });
        await tx.connection.deleteMany({
          where: {
            status: ConnectionStatus.PENDING,
            OR: [{ requesterId: report.reportedId }, { addresseeId: report.reportedId }],
          },
        });
      }
    });

    if (dto.action === 'BAN' || dto.action === 'SUSPEND') {
      await this._withdrawPresence(report.reportedId);
    }

    return { success: true };
  }

  private async _withdrawPresence(userId: string) {
    const storeId = await this.redis.get(`presence:${userId}`);
    if (storeId) {
      await Promise.all([
        this.redis.del(`presence:${userId}`),
        this.redis.zrem(`store_members:${storeId}`, userId),
      ]);
    }
  }
}
