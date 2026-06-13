import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';

export type BadgeCriteria =
  | { type: 'first_checkin' }
  | { type: 'store_total'; count: number }
  | { type: 'global_total'; count: number }
  | { type: 'streak'; length: number }
  | { type: 'unique_stores'; count: number };

export interface EarnedBadge {
  id: string;
  code: string;
  name: string;
  icon: string;
  description: string | null;
}

export interface CheckinGamificationResult {
  newBadges: EarnedBadge[];
  streak: { currentStreak: number; longestStreak: number; totalCheckins: number } | null;
}

// Weekly cadence: streak increments if last checkin was 1–8 days ago, else resets
const STREAK_WINDOW_DAYS = 8;

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    @InjectQueue('gamification') private readonly queue: Queue,
  ) {}

  async processCheckin(userId: string, storeId: string): Promise<CheckinGamificationResult> {
    const [streak, newBadges] = await Promise.all([
      this.updateStreak(userId, storeId),
      this.evaluateAndAwardBadges(userId, storeId),
    ]);

    // Enqueue async leaderboard refresh
    await this.queue.add('leaderboard:refresh', { storeId }, { removeOnComplete: 100, removeOnFail: 50 });

    return { newBadges, streak };
  }

  // ---------------------------------------------------------------------------
  // Streak
  // ---------------------------------------------------------------------------

  private async updateStreak(
    userId: string,
    storeId: string,
  ): Promise<CheckinGamificationResult['streak']> {
    const now = new Date();
    const existing = await this.prisma.streak.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });

    if (!existing) {
      const s = await this.prisma.streak.create({
        data: { userId, storeId, currentStreak: 1, longestStreak: 1, totalCheckins: 1, lastCheckinAt: now },
      });
      return { currentStreak: s.currentStreak, longestStreak: s.longestStreak, totalCheckins: s.totalCheckins };
    }

    const daysSinceLast = (now.getTime() - existing.lastCheckinAt.getTime()) / 86_400_000;

    let newStreak: number;
    if (daysSinceLast < 1) {
      // Same-day check-in: don't increment streak, still count total
      newStreak = existing.currentStreak;
    } else if (daysSinceLast <= STREAK_WINDOW_DAYS) {
      newStreak = existing.currentStreak + 1;
    } else {
      newStreak = 1;
    }

    const newLongest = Math.max(existing.longestStreak, newStreak);
    const s = await this.prisma.streak.update({
      where: { userId_storeId: { userId, storeId } },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        totalCheckins: { increment: 1 },
        lastCheckinAt: now,
      },
    });

    return { currentStreak: s.currentStreak, longestStreak: s.longestStreak, totalCheckins: s.totalCheckins };
  }

  // ---------------------------------------------------------------------------
  // Badge evaluation
  // ---------------------------------------------------------------------------

  private async evaluateAndAwardBadges(userId: string, storeId: string): Promise<EarnedBadge[]> {
    const [allBadges, alreadyEarned] = await Promise.all([
      this.prisma.badge.findMany(),
      this.prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    ]);

    const earnedSet = new Set(alreadyEarned.map((ub) => ub.badgeId));
    const candidates = allBadges.filter((b) => !earnedSet.has(b.id));
    if (candidates.length === 0) return [];

    // Fetch stats needed for evaluation (batch to avoid N+1)
    const [globalTotal, storeTotal, uniqueStoreCount, currentStreak] = await Promise.all([
      this.prisma.checkin.count({ where: { userId } }),
      this.prisma.checkin.count({ where: { userId, storeId } }),
      this.prisma.checkin.groupBy({ by: ['storeId'], where: { userId } }).then((r) => r.length),
      this.prisma.streak.findUnique({ where: { userId_storeId: { userId, storeId } } }).then((s) => s?.currentStreak ?? 1),
    ]);

    const newlyEarned: EarnedBadge[] = [];

    for (const badge of candidates) {
      const criteria = badge.criteria as BadgeCriteria;
      let qualifies = false;

      switch (criteria.type) {
        case 'first_checkin':
          qualifies = globalTotal === 1;
          break;
        case 'store_total':
          qualifies = storeTotal >= criteria.count;
          break;
        case 'global_total':
          qualifies = globalTotal >= criteria.count;
          break;
        case 'streak':
          qualifies = currentStreak >= criteria.length;
          break;
        case 'unique_stores':
          qualifies = uniqueStoreCount >= criteria.count;
          break;
      }

      if (qualifies) {
        try {
          await this.prisma.userBadge.create({
            data: { userId, badgeId: badge.id, storeId },
          });
          newlyEarned.push({
            id: badge.id,
            code: badge.code,
            name: badge.name,
            icon: badge.icon,
            description: badge.description,
          });
        } catch {
          // Race condition: badge already awarded
        }
      }
    }

    return newlyEarned;
  }

  // ---------------------------------------------------------------------------
  // Leaderboard (called from processor)
  // ---------------------------------------------------------------------------

  async refreshLeaderboard(storeId: string): Promise<void> {
    const streaks = await this.prisma.streak.findMany({
      where: { storeId },
      select: { userId: true, currentStreak: true, totalCheckins: true },
    });

    if (streaks.length === 0) return;

    const pipeline = this.redis.pipeline();
    for (const s of streaks) {
      pipeline.zadd(`leaderboard:${storeId}:streak`, s.currentStreak, s.userId);
      pipeline.zadd(`leaderboard:${storeId}:total`, s.totalCheckins, s.userId);
    }
    // TTL: 24h — refreshed on every checkin
    pipeline.expire(`leaderboard:${storeId}:streak`, 86_400);
    pipeline.expire(`leaderboard:${storeId}:total`, 86_400);
    await pipeline.exec();
  }

  async getLeaderboard(callerId: string, storeId: string): Promise<{
    entries: Array<{
      rank: number;
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      avatarColors: string[];
      currentStreak: number;
      totalCheckins: number;
      isMe: boolean;
    }>;
    myEntry: { rank: number; currentStreak: number; totalCheckins: number } | null;
  }> {
    // Try Redis first
    const redisEntries = await this.redis.zrevrange(`leaderboard:${storeId}:streak`, 0, 49, 'WITHSCORES');

    let rankedUserIds: Array<{ userId: string; score: number }> = [];
    if (redisEntries.length > 0) {
      for (let i = 0; i < redisEntries.length; i += 2) {
        rankedUserIds.push({ userId: redisEntries[i], score: Number(redisEntries[i + 1]) });
      }
    } else {
      // Fallback to DB
      const dbStreaks = await this.prisma.streak.findMany({
        where: { storeId },
        orderBy: { currentStreak: 'desc' },
        take: 50,
        select: { userId: true, currentStreak: true },
      });
      rankedUserIds = dbStreaks.map((s) => ({ userId: s.userId, score: s.currentStreak }));
    }

    if (rankedUserIds.length === 0) return { entries: [], myEntry: null };

    const userIds = rankedUserIds.map((r) => r.userId);

    // Fetch profiles + privacy in one query, filter to discoverable
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        avatarColors: true,
        privacySettings: { select: { discoverable: true } },
      },
    });

    const visibleUserMap = new Map(
      users
        .filter((u) => u.id === callerId || (u.privacySettings?.discoverable ?? true))
        .map((u) => [u.id, u]),
    );

    // Fetch per-store stats for all visible users
    const streakMap = await this.prisma.streak
      .findMany({
        where: { storeId, userId: { in: [...visibleUserMap.keys()] } },
        select: { userId: true, currentStreak: true, totalCheckins: true },
      })
      .then((rows) => new Map(rows.map((r) => [r.userId, r])));

    const entries: Array<{ rank: number; userId: string; displayName: string; avatarUrl: string | null; avatarColors: string[]; currentStreak: number; totalCheckins: number; isMe: boolean }> = [];
    let rank = 0;
    for (const { userId } of rankedUserIds) {
      const user = visibleUserMap.get(userId);
      if (!user) continue;
      rank++;
      const stats = streakMap.get(userId);
      entries.push({
        rank,
        userId: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        avatarColors: user.avatarColors,
        currentStreak: stats?.currentStreak ?? 0,
        totalCheckins: stats?.totalCheckins ?? 0,
        isMe: userId === callerId,
      });
      if (entries.length >= 20) break;
    }

    // Caller's own entry (even if not in top 20)
    let myEntry: { rank: number; currentStreak: number; totalCheckins: number } | null = null;
    const myRankIndex = rankedUserIds.findIndex((r) => r.userId === callerId);
    if (myRankIndex >= 0) {
      const myStats = streakMap.get(callerId);
      myEntry = {
        rank: myRankIndex + 1,
        currentStreak: myStats?.currentStreak ?? 0,
        totalCheckins: myStats?.totalCheckins ?? 0,
      };
    }

    return { entries, myEntry };
  }

  async getUserBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      select: {
        id: true,
        earnedAt: true,
        store: { select: { id: true, name: true } },
        badge: { select: { id: true, code: true, name: true, icon: true, description: true } },
      },
      orderBy: { earnedAt: 'desc' },
    });
  }
}
