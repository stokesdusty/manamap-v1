import { Injectable } from '@nestjs/common';
import type { NotificationKind, Prisma } from '@prisma/client';
import { Expo } from 'expo-server-sdk';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service';

interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: NotificationInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        ...(input.data !== undefined ? { data: input.data as Prisma.InputJsonValue } : {}),
      },
    });

    void this.sendPush(userId, input);
  }

  async createBulk(userIds: string[], input: NotificationInput): Promise<void> {
    if (!userIds.length) return;

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        ...(input.data !== undefined ? { data: input.data as Prisma.InputJsonValue } : {}),
      })),
    });

    const tokenRows = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
    });
    const valid = tokenRows.filter((r) => Expo.isExpoPushToken(r.token));
    if (!valid.length) return;

    const messages: ExpoPushMessage[] = valid.map((r) => ({
      to: r.token,
      title: input.title,
      body: input.body,
      ...(input.data !== undefined ? { data: input.data } : {}),
    }));

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
    } catch {
      // Push failures are non-fatal
    }
  }

  async list(userId: string, cursor?: string, limit = 20) {
    const take = Math.min(limit, 50);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    return {
      items: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        data: n.data as Record<string, unknown> | null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: string, ids?: string[]): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private async sendPush(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ): Promise<void> {
    const rows = await this.prisma.pushToken.findMany({ where: { userId } });
    const valid = rows.filter((r) => Expo.isExpoPushToken(r.token));
    if (!valid.length) return;

    const messages: ExpoPushMessage[] = valid.map((r) => ({
      to: r.token,
      title: payload.title,
      body: payload.body,
      ...(payload.data !== undefined ? { data: payload.data } : {}),
    }));

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
    } catch {
      // Push failures are non-fatal
    }
  }
}
