import { ForbiddenException, HttpException, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { Expo } from 'expo-server-sdk';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import type { SendBroadcast } from '@manamap/shared';

const BROADCAST_DAILY_CAP = 3;

// Returns the UTC instant corresponding to midnight of today in the given IANA timezone.
function localMidnightUtc(timezone: string): Date {
  const localDate = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  const candidate = new Date(`${localDate}T00:00:00Z`);
  const localTime = new Date(candidate.toLocaleString('en-US', { timeZone: timezone }));
  const offset = candidate.getTime() - localTime.getTime();
  return new Date(candidate.getTime() + offset);
}

const storeMembersKey = (storeId: string) => `store_members:${storeId}`;
const presenceKey = (userId: string) => `presence:${userId}`;

@Injectable()
export class BroadcastService {
  private readonly expo = new Expo();

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async getAudienceCounts(userId: string, storeId: string) {
    await this.assertOwner(userId, storeId);

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { timezone: true },
    });
    const timezone = store?.timezone ?? 'America/Los_Angeles';
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

    const [checkedInNow, todayRows, nextEvent, recent30dRows] = await Promise.all([
      this.getActiveMembers(storeId),
      this.prisma.checkin.groupBy({
        by: ['userId'],
        where: { storeId, checkedInAt: { gte: localMidnightUtc(timezone) } },
      }),
      this.prisma.event.findFirst({
        where: { storeId, startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, name: true, _count: { select: { attendees: true } } },
      }),
      this.prisma.checkin.groupBy({
        by: ['userId'],
        where: { storeId, checkedInAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    return {
      CHECKED_IN_NOW: checkedInNow.length,
      TODAY: todayRows.length,
      EVENT_RSVPS: {
        count: nextEvent?._count.attendees ?? 0,
        eventId: nextEvent?.id ?? null,
        eventName: nextEvent?.name ?? null,
      },
      RECENT_30D: recent30dRows.length,
    };
  }

  async sendBroadcast(userId: string, storeId: string, dto: SendBroadcast) {
    await this.assertOwner(userId, storeId);

    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await this.prisma.broadcast.count({
      where: { storeId, createdAt: { gte: windowStart } },
    });
    if (sentToday >= BROADCAST_DAILY_CAP) {
      throw new HttpException(
        `Broadcast limit reached: max ${BROADCAST_DAILY_CAP} broadcasts per 24 hours. Try again later.`,
        429,
      );
    }

    const recipientIds = await this.resolveRecipients(storeId, dto.audience, dto.eventId, userId);

    const broadcast = await this.prisma.broadcast.create({
      data: {
        storeId,
        sentById: userId,
        audience: dto.audience as any,
        title: dto.title,
        body: dto.body,
        ...(dto.eventId !== undefined ? { eventId: dto.eventId } : {}),
        recipientCount: recipientIds.length,
      },
    });

    // Fan-out is fire-and-forget; push failures must not block the response
    this.fanOutPush(recipientIds, dto.title, dto.body, storeId).catch(() => {});

    return { id: broadcast.id, recipientCount: recipientIds.length };
  }

  async listBroadcasts(userId: string, storeId: string) {
    await this.assertOwner(userId, storeId);
    return this.prisma.broadcast.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        audience: true,
        title: true,
        body: true,
        eventId: true,
        recipientCount: true,
        createdAt: true,
      },
    });
  }

  private async resolveRecipients(
    storeId: string,
    audience: string,
    eventId: string | undefined,
    senderId: string,
  ): Promise<string[]> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { timezone: true },
    });
    const timezone = store?.timezone ?? 'America/Los_Angeles';
    const now = new Date();

    let userIds: string[] = [];

    if (audience === 'CHECKED_IN_NOW') {
      userIds = await this.getActiveMembers(storeId);
    } else if (audience === 'TODAY') {
      const rows = await this.prisma.checkin.groupBy({
        by: ['userId'],
        where: { storeId, checkedInAt: { gte: localMidnightUtc(timezone) } },
      });
      userIds = rows.map((r) => r.userId);
    } else if (audience === 'EVENT_RSVPS') {
      const evId =
        eventId ??
        (
          await this.prisma.event.findFirst({
            where: { storeId, startsAt: { gte: now } },
            orderBy: { startsAt: 'asc' },
            select: { id: true },
          })
        )?.id;
      if (evId) {
        const rows = await this.prisma.eventAttendee.findMany({
          where: { eventId: evId },
          select: { userId: true },
        });
        userIds = rows.map((r) => r.userId);
      }
    } else if (audience === 'RECENT_30D') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
      const rows = await this.prisma.checkin.groupBy({
        by: ['userId'],
        where: { storeId, checkedInAt: { gte: thirtyDaysAgo } },
      });
      userIds = rows.map((r) => r.userId);
    }

    if (!userIds.length) return [];

    const optedOut = await this.prisma.privacySettings.findMany({
      where: { userId: { in: userIds }, storeMessages: false },
      select: { userId: true },
    });
    const excluded = new Set(optedOut.map((r) => r.userId));
    excluded.add(senderId);

    return userIds.filter((id) => !excluded.has(id));
  }

  private async getActiveMembers(storeId: string): Promise<string[]> {
    const allIds = await this.redis.zrange(storeMembersKey(storeId), 0, -1);
    if (!allIds.length) return [];
    const existsResults = await Promise.all(allIds.map((id) => this.redis.exists(presenceKey(id))));
    const valid: string[] = [];
    const expired: string[] = [];
    allIds.forEach((id, i) => {
      if (existsResults[i]) valid.push(id);
      else expired.push(id);
    });
    if (expired.length) await this.redis.zrem(storeMembersKey(storeId), ...expired);
    return valid;
  }

  private async fanOutPush(
    userIds: string[],
    title: string,
    body: string,
    storeId: string,
  ): Promise<void> {
    if (!userIds.length) return;
    const tokenRows = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
    });
    const valid = tokenRows.filter((r) => Expo.isExpoPushToken(r.token));
    if (!valid.length) return;

    const messages: ExpoPushMessage[] = valid.map((r) => ({
      to: r.token,
      title,
      body,
      data: { type: 'store_broadcast', storeId },
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

  private async assertOwner(userId: string, storeId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'ADMIN') return;
    const owns = await this.prisma.storeOwnership.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { id: true },
    });
    if (!owns) throw new ForbiddenException('You do not own this store');
  }
}
