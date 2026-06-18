import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import type { HeartbeatBody } from '@manamap/shared';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';

const PRESENCE_TTL = 300; // 5 minutes — heartbeat interval should be well under this
const presenceKey = (userId: string) => `presence:${userId}`;
const storeMembersKey = (storeId: string) => `store_members:${storeId}`;

@Injectable()
export class PresenceService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
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

}
