import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
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

  async heartbeat(userId: string, storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    // If the user was at a different store, remove them from that store's set
    const currentStoreId = await this.redis.get(presenceKey(userId));
    if (currentStoreId && currentStoreId !== storeId) {
      await this.redis.zrem(storeMembersKey(currentStoreId), userId);
    }

    // Refresh presence key and add to store member sorted set (score = now for recency)
    await Promise.all([
      this.redis.setex(presenceKey(userId), PRESENCE_TTL, storeId),
      this.redis.zadd(storeMembersKey(storeId), Date.now(), userId),
    ]);

    return { storeId: store.id, storeName: store.name, expiresIn: PRESENCE_TTL };
  }

}
