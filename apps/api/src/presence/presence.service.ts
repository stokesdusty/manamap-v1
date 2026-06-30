import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import { NotificationKind } from '@prisma/client';
import type { HeartbeatBody } from '@manamap/shared';
import { REDIS } from '../redis/redis.module';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

const PRESENCE_TTL = 300; // 5 minutes — heartbeat interval should be well under this
const NOTIFY_THRESHOLD_TTL = 6 * 60 * 60; // 6 hours — one-shot subscription expires if never triggered
const presenceKey = (userId: string) => `presence:${userId}`;
const storeMembersKey = (storeId: string) => `store_members:${storeId}`;
const notifySubsKey = (storeId: string) => `notify_active_subs:${storeId}`;
const notifyThresholdKey = (storeId: string, userId: string) =>
  `notify_active:${storeId}:${userId}`;

@Injectable()
export class PresenceService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async heartbeat(userId: string, body: HeartbeatBody) {
    const { storeId, lat, lng } = body;
    let storeInfo: { id: string; name: string } | null = null;

    if (storeId) {
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true },
      });
      if (!store) throw new NotFoundException('Store not found');
      storeInfo = store;

      const currentStoreId = await this.redis.get(presenceKey(userId));
      if (currentStoreId && currentStoreId !== storeId) {
        await this.redis.zrem(storeMembersKey(currentStoreId), userId);
      }

      await Promise.all([
        this.redis.setex(presenceKey(userId), PRESENCE_TTL, storeId),
        this.redis.zadd(storeMembersKey(storeId), Date.now(), userId),
      ]);

      void this.checkAndNotifyThreshold(storeId, storeInfo.name);
    }

    // Always persist last-known location when provided
    if (lat != null && lng != null) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLat: lat, lastLng: lng, lastLocatedAt: new Date() },
      });
    }

    return {
      storeId: storeInfo?.id ?? null,
      storeName: storeInfo?.name ?? null,
      expiresIn: PRESENCE_TTL,
    };
  }

  async checkout(userId: string): Promise<void> {
    const storeId = await this.redis.get(presenceKey(userId));
    if (storeId) {
      await this.redis.zrem(storeMembersKey(storeId), userId);
    }
    await this.redis.del(presenceKey(userId));
  }

  async getStoreMembers(storeId: string): Promise<string[]> {
    const allIds = await this.redis.zrange(storeMembersKey(storeId), 0, -1);
    if (!allIds.length) return [];

    const existsResults = await Promise.all(allIds.map((id) => this.redis.exists(presenceKey(id))));
    const validIds: string[] = [];
    const expiredIds: string[] = [];
    allIds.forEach((id, i) => {
      if (existsResults[i]) validIds.push(id);
      else expiredIds.push(id);
    });

    if (expiredIds.length) await this.redis.zrem(storeMembersKey(storeId), ...expiredIds);
    return validIds;
  }

  // -------------------------------------------------------------------------
  // Notify-when-active subscriptions
  // -------------------------------------------------------------------------

  async subscribeNotifyWhenActive(
    userId: string,
    storeId: string,
    threshold: number,
  ): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    await Promise.all([
      this.redis.set(notifyThresholdKey(storeId, userId), threshold, 'EX', NOTIFY_THRESHOLD_TTL),
      this.redis.sadd(notifySubsKey(storeId), userId),
    ]);
  }

  private async checkAndNotifyThreshold(storeId: string, storeName: string): Promise<void> {
    const subscriberIds = await this.redis.smembers(notifySubsKey(storeId));
    if (!subscriberIds.length) return;

    const members = await this.getStoreMembers(storeId);
    await Promise.all(
      subscriberIds.map((subscriberId) =>
        this.maybeNotifySubscriber(storeId, storeName, subscriberId, members),
      ),
    );
  }

  private async maybeNotifySubscriber(
    storeId: string,
    storeName: string,
    subscriberId: string,
    members: string[],
  ): Promise<void> {
    const thresholdRaw = await this.redis.get(notifyThresholdKey(storeId, subscriberId));
    if (!thresholdRaw) {
      await this.redis.srem(notifySubsKey(storeId), subscriberId);
      return;
    }

    const otherCount = members.filter((id) => id !== subscriberId).length;
    if (otherCount < Number(thresholdRaw)) return;

    // GETDEL atomically claims the subscription — guards against a concurrent
    // heartbeat for the same store firing a duplicate notification.
    const claimed = await this.redis.getdel(notifyThresholdKey(storeId, subscriberId));
    if (!claimed) return;

    await this.redis.srem(notifySubsKey(storeId), subscriberId);

    await this.notifications.create(subscriberId, {
      kind: NotificationKind.NEARBY,
      title: 'Players are here',
      body: `${otherCount} player${otherCount === 1 ? '' : 's'} just checked in at ${storeName}`,
      data: { type: 'store_active', storeId },
    });
  }
}
