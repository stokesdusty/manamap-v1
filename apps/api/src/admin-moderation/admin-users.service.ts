import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ModerationActionType } from '@prisma/client';
import { ConnectionStatus, ModerationStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import type { AdminUpdateUser, AdminUserAction } from '@manamap/shared';
import { REDIS } from '../redis/redis.module';
import type { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async search(q: string | undefined) {
    const query = q?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { identities: { some: { discordHandle: { contains: query, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        moderationStatus: true,
        avatarColors: true,
        isBot: true,
        identities: { select: { discordHandle: true }, take: 1 },
      },
    });

    return users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      handle: u.identities[0]?.discordHandle ?? null,
      role: u.role,
      moderationStatus: u.moderationStatus,
      avatarColors: u.avatarColors,
      isBot: u.isBot,
    }));
  }

  async getDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        moderationStatus: true,
        suspendedUntil: true,
        createdAt: true,
        avatarColors: true,
        isBot: true,
        identities: { select: { provider: true, discordHandle: true } },
        ownerships: { select: { storeId: true, store: { select: { name: true } } } },
        reportsAgainst: {
          select: { id: true, reason: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        targetedActions: {
          select: { id: true, action: true, note: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [checkins, connections, gamesPlayed] = await Promise.all([
      this.prisma.checkin.count({ where: { userId } }),
      this.prisma.connection.count({
        where: {
          status: ConnectionStatus.ACCEPTED,
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
      this.prisma.gamePlayer.count({ where: { userId } }),
    ]);

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      handle: user.identities[0]?.discordHandle ?? null,
      role: user.role,
      moderationStatus: user.moderationStatus,
      avatarColors: user.avatarColors,
      isBot: user.isBot,
      suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      identities: user.identities.map((i) => ({
        provider: i.provider,
        discordHandle: i.discordHandle,
      })),
      storeOwnerships: user.ownerships.map((o) => ({
        storeId: o.storeId,
        storeName: o.store.name,
      })),
      counts: { checkins, connections, gamesPlayed },
      reportsAgainst: user.reportsAgainst.map((r) => ({
        id: r.id,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      moderationHistory: user.targetedActions.map((a) => ({
        id: a.id,
        action: a.action,
        note: a.note,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async takeModerationAction(adminId: string, targetUserId: string, dto: AdminUserAction) {
    if (targetUserId === adminId) {
      throw new BadRequestException({ code: 'cannot_moderate_self' });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.moderationAction.create({
        data: {
          targetUserId,
          adminId,
          action: dto.action as ModerationActionType,
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
      });

      if (dto.action === 'SUSPEND') {
        const days = dto.suspendDays ?? 7;
        const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await tx.user.update({
          where: { id: targetUserId },
          data: { moderationStatus: ModerationStatus.SUSPENDED, suspendedUntil },
        });
      } else if (dto.action === 'BAN') {
        await tx.user.update({
          where: { id: targetUserId },
          data: { moderationStatus: ModerationStatus.BANNED, suspendedUntil: null },
        });
        await tx.connection.deleteMany({
          where: {
            status: ConnectionStatus.PENDING,
            OR: [{ requesterId: targetUserId }, { addresseeId: targetUserId }],
          },
        });
      } else if (dto.action === 'UNBAN') {
        await tx.user.update({
          where: { id: targetUserId },
          data: { moderationStatus: ModerationStatus.ACTIVE, suspendedUntil: null },
        });
      }
    });

    if (dto.action === 'BAN' || dto.action === 'SUSPEND') {
      await this._withdrawPresence(targetUserId);
    }

    return { success: true };
  }

  async updateProfile(adminId: string, targetUserId: string, dto: AdminUpdateUser) {
    if (dto.role !== undefined && targetUserId === adminId && dto.role !== 'ADMIN') {
      throw new BadRequestException({ code: 'cannot_demote_self' });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
      },
      select: { id: true, displayName: true, role: true },
    });
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
