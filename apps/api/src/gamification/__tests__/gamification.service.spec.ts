import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { GamificationService } from '../gamification.service';
import type { BadgeCriteria } from '../gamification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';

function makePrismaMock() {
  return {
    streak: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    badge: { findMany: jest.fn() },
    userBadge: { findMany: jest.fn(), create: jest.fn() },
    checkin: { count: jest.fn(), groupBy: jest.fn() },
    user: { findMany: jest.fn() },
    gameLog: { groupBy: jest.fn() },
  };
}

function makePipelineMock() {
  const p = {
    zadd: jest.fn(),
    expire: jest.fn(),
    exec: jest.fn().mockResolvedValue([]),
  };
  p.zadd.mockReturnValue(p);
  p.expire.mockReturnValue(p);
  return p;
}

function makeRedisMock() {
  const pipeline = makePipelineMock();
  return {
    pipeline: jest.fn().mockReturnValue(pipeline),
    zrevrange: jest.fn().mockResolvedValue([]),
    _pipeline: pipeline,
  };
}

function makeBadge(id: string, criteria: BadgeCriteria) {
  return { id, code: `badge_${id}`, name: `Badge ${id}`, icon: '🏆', description: null, criteria };
}

describe('GamificationService', () => {
  let service: GamificationService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    queue = { add: jest.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS, useValue: redis },
        { provide: getQueueToken('gamification'), useValue: queue },
      ],
    }).compile();

    service = module.get(GamificationService);
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Suppress badge evaluation side-effects so streak tests stay focused. */
  function suppressBadges() {
    prisma.badge.findMany.mockResolvedValue([]);
    prisma.userBadge.findMany.mockResolvedValue([]);
    prisma.checkin.count.mockResolvedValue(1);
    prisma.checkin.groupBy.mockResolvedValue([{ storeId: 'store1' }]);
  }

  /** Suppress streak side-effects so badge tests stay focused. */
  function suppressStreak(currentStreak = 1) {
    // updateStreak: no existing record → create path
    prisma.streak.findUnique
      .mockResolvedValueOnce(null) // updateStreak lookup
      .mockResolvedValueOnce({ currentStreak }); // evaluateAndAwardBadges lookup
    prisma.streak.create.mockResolvedValue({
      currentStreak,
      longestStreak: currentStreak,
      totalCheckins: 1,
    });
  }

  function setupCheckinCounts(globalTotal: number, storeTotal: number, uniqueStores: number) {
    prisma.checkin.count.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(where.storeId !== undefined ? storeTotal : globalTotal),
    );
    prisma.checkin.groupBy.mockResolvedValue(
      Array.from({ length: uniqueStores }, (_, i) => ({ storeId: `s${i}` })),
    );
  }

  // ---------------------------------------------------------------------------
  // Streak (exercised through processCheckin)
  // ---------------------------------------------------------------------------

  describe('streak logic', () => {
    beforeEach(() => suppressBadges());

    it('creates a 1/1/1 streak on the first visit to a store', async () => {
      prisma.streak.findUnique.mockResolvedValue(null);
      prisma.streak.create.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
        totalCheckins: 1,
      });

      const { streak } = await service.processCheckin('user1', 'store1');

      expect(prisma.streak.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            storeId: 'store1',
            currentStreak: 1,
            longestStreak: 1,
            totalCheckins: 1,
          }),
        }),
      );
      expect(streak).toEqual({ currentStreak: 1, longestStreak: 1, totalCheckins: 1 });
    });

    it('does not increment currentStreak on a same-day check-in', async () => {
      prisma.streak.findUnique.mockResolvedValue({
        currentStreak: 3,
        longestStreak: 5,
        totalCheckins: 10,
        lastCheckinAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      });
      prisma.streak.update.mockResolvedValue({
        currentStreak: 3,
        longestStreak: 5,
        totalCheckins: 11,
      });

      await service.processCheckin('user1', 'store1');

      const data = prisma.streak.update.mock.calls[0][0].data;
      expect(data.currentStreak).toBe(3);
      expect(data.totalCheckins).toEqual({ increment: 1 });
    });

    it('increments currentStreak when last check-in was within the 8-day window', async () => {
      prisma.streak.findUnique.mockResolvedValue({
        currentStreak: 2,
        longestStreak: 2,
        totalCheckins: 5,
        lastCheckinAt: new Date(Date.now() - 3 * 24 * 3600 * 1000), // 3 days ago
      });
      prisma.streak.update.mockResolvedValue({
        currentStreak: 3,
        longestStreak: 3,
        totalCheckins: 6,
      });

      await service.processCheckin('user1', 'store1');

      const data = prisma.streak.update.mock.calls[0][0].data;
      expect(data.currentStreak).toBe(3);
    });

    it('resets currentStreak to 1 when the 8-day window has lapsed', async () => {
      prisma.streak.findUnique.mockResolvedValue({
        currentStreak: 5,
        longestStreak: 5,
        totalCheckins: 20,
        lastCheckinAt: new Date(Date.now() - 10 * 24 * 3600 * 1000), // 10 days ago
      });
      prisma.streak.update.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 5,
        totalCheckins: 21,
      });

      await service.processCheckin('user1', 'store1');

      const data = prisma.streak.update.mock.calls[0][0].data;
      expect(data.currentStreak).toBe(1);
    });

    it('updates longestStreak when the new streak surpasses the previous best', async () => {
      prisma.streak.findUnique.mockResolvedValue({
        currentStreak: 4,
        longestStreak: 4,
        totalCheckins: 8,
        lastCheckinAt: new Date(Date.now() - 2 * 24 * 3600 * 1000), // 2 days ago
      });
      prisma.streak.update.mockResolvedValue({
        currentStreak: 5,
        longestStreak: 5,
        totalCheckins: 9,
      });

      await service.processCheckin('user1', 'store1');

      const data = prisma.streak.update.mock.calls[0][0].data;
      expect(data.longestStreak).toBe(5); // max(4, 5)
    });

    it('does not lower longestStreak after a reset', async () => {
      prisma.streak.findUnique.mockResolvedValue({
        currentStreak: 7,
        longestStreak: 7,
        totalCheckins: 30,
        lastCheckinAt: new Date(Date.now() - 10 * 24 * 3600 * 1000), // lapsed
      });
      prisma.streak.update.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 7,
        totalCheckins: 31,
      });

      await service.processCheckin('user1', 'store1');

      const data = prisma.streak.update.mock.calls[0][0].data;
      expect(data.longestStreak).toBe(7); // max(7, 1) = 7
    });

    it('enqueues a leaderboard:refresh job for the store', async () => {
      prisma.streak.findUnique.mockResolvedValue(null);
      prisma.streak.create.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
        totalCheckins: 1,
      });

      await service.processCheckin('user1', 'store1');

      expect(queue.add).toHaveBeenCalledWith(
        'leaderboard:refresh',
        { storeId: 'store1' },
        expect.any(Object),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Badge evaluation (exercised through processCheckin)
  // ---------------------------------------------------------------------------

  describe('badge evaluation', () => {
    it('returns no badges and skips DB queries when all badges are already earned', async () => {
      suppressStreak();
      const badge = makeBadge('b1', { type: 'first_checkin' });
      prisma.badge.findMany.mockResolvedValue([badge]);
      prisma.userBadge.findMany.mockResolvedValue([{ badgeId: 'b1' }]);
      setupCheckinCounts(1, 1, 1);

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(0);
      expect(prisma.checkin.count).not.toHaveBeenCalled();
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it('awards first_checkin when globalTotal === 1', async () => {
      suppressStreak();
      prisma.badge.findMany.mockResolvedValue([makeBadge('b1', { type: 'first_checkin' })]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(1, 1, 1);
      prisma.userBadge.create.mockResolvedValue({});

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(1);
      expect(newBadges[0].id).toBe('b1');
    });

    it('does not award first_checkin when globalTotal > 1', async () => {
      suppressStreak();
      prisma.badge.findMany.mockResolvedValue([makeBadge('b1', { type: 'first_checkin' })]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(2, 2, 1);

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(0);
    });

    it('awards store_total when storeTotal meets the threshold', async () => {
      suppressStreak();
      prisma.badge.findMany.mockResolvedValue([makeBadge('b1', { type: 'store_total', count: 5 })]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(10, 5, 2);
      prisma.userBadge.create.mockResolvedValue({});

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(1);
    });

    it('does not award store_total when storeTotal is below the threshold', async () => {
      suppressStreak();
      prisma.badge.findMany.mockResolvedValue([makeBadge('b1', { type: 'store_total', count: 5 })]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(10, 4, 2);

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(0);
    });

    it('awards global_total when globalTotal meets the threshold', async () => {
      suppressStreak();
      prisma.badge.findMany.mockResolvedValue([
        makeBadge('b1', { type: 'global_total', count: 10 }),
      ]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(10, 3, 2);
      prisma.userBadge.create.mockResolvedValue({});

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(1);
    });

    it('awards streak badge when currentStreak meets the threshold', async () => {
      suppressStreak(5); // streak value used in evaluateAndAwardBadges
      prisma.badge.findMany.mockResolvedValue([makeBadge('b1', { type: 'streak', length: 5 })]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(5, 5, 1);
      prisma.userBadge.create.mockResolvedValue({});

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(1);
    });

    it('does not award streak badge when currentStreak is below the threshold', async () => {
      suppressStreak(2); // streak is 2, badge needs 5
      prisma.badge.findMany.mockResolvedValue([makeBadge('b1', { type: 'streak', length: 5 })]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(2, 2, 1);

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(0);
    });

    it('awards unique_stores when the count meets the threshold', async () => {
      suppressStreak();
      prisma.badge.findMany.mockResolvedValue([
        makeBadge('b1', { type: 'unique_stores', count: 3 }),
      ]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(5, 5, 3);
      prisma.userBadge.create.mockResolvedValue({});

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(1);
    });

    it('never awards quest_reward (always qualifies = false)', async () => {
      suppressStreak();
      prisma.badge.findMany.mockResolvedValue([makeBadge('b1', { type: 'quest_reward' })]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(1, 1, 1);

      const { newBadges } = await service.processCheckin('user1', 'store1');

      expect(newBadges).toHaveLength(0);
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it('silently recovers from a race-condition duplicate badge error', async () => {
      suppressStreak();
      prisma.badge.findMany.mockResolvedValue([makeBadge('b1', { type: 'first_checkin' })]);
      prisma.userBadge.findMany.mockResolvedValue([]);
      setupCheckinCounts(1, 1, 1);
      prisma.userBadge.create.mockRejectedValue(new Error('Unique constraint failed'));

      await expect(service.processCheckin('user1', 'store1')).resolves.toMatchObject({
        newBadges: [],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // refreshLeaderboard
  // ---------------------------------------------------------------------------

  describe('refreshLeaderboard', () => {
    it('writes streak and total scores to the Redis pipeline', async () => {
      prisma.streak.findMany.mockResolvedValue([
        { userId: 'u1', currentStreak: 5, totalCheckins: 20 },
        { userId: 'u2', currentStreak: 3, totalCheckins: 10 },
      ]);

      await service.refreshLeaderboard('store1');

      const pipe = redis._pipeline;
      expect(pipe.zadd).toHaveBeenCalledWith('leaderboard:store1:streak', 5, 'u1');
      expect(pipe.zadd).toHaveBeenCalledWith('leaderboard:store1:total', 20, 'u1');
      expect(pipe.zadd).toHaveBeenCalledWith('leaderboard:store1:streak', 3, 'u2');
      expect(pipe.zadd).toHaveBeenCalledWith('leaderboard:store1:total', 10, 'u2');
      expect(pipe.expire).toHaveBeenCalledWith('leaderboard:store1:streak', 86_400);
      expect(pipe.expire).toHaveBeenCalledWith('leaderboard:store1:total', 86_400);
      expect(pipe.exec).toHaveBeenCalled();
    });

    it('no-ops and does not touch Redis when no streaks exist for the store', async () => {
      prisma.streak.findMany.mockResolvedValue([]);

      await service.refreshLeaderboard('store1');

      expect(redis.pipeline).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getLeaderboard
  // ---------------------------------------------------------------------------

  describe('getLeaderboard', () => {
    const alice = {
      id: 'u1',
      displayName: 'Alice',
      avatarUrl: null,
      avatarColors: [],
      privacySettings: { discoverable: true },
    };
    const bob = {
      id: 'u2',
      displayName: 'Bob',
      avatarUrl: null,
      avatarColors: [],
      privacySettings: { discoverable: true },
    };

    it('returns ranked entries from Redis when the cache is populated', async () => {
      redis.zrevrange.mockResolvedValue(['u1', '5', 'u2', '3']);
      prisma.user.findMany.mockResolvedValue([alice, bob]);
      prisma.streak.findMany.mockResolvedValue([
        { userId: 'u1', currentStreak: 5, totalCheckins: 20 },
        { userId: 'u2', currentStreak: 3, totalCheckins: 10 },
      ]);

      const { entries } = await service.getLeaderboard('caller', 'store1');

      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({
        rank: 1,
        userId: 'u1',
        displayName: 'Alice',
        currentStreak: 5,
      });
      expect(entries[1]).toMatchObject({ rank: 2, userId: 'u2', currentStreak: 3 });
    });

    it('falls back to DB when Redis cache is empty', async () => {
      redis.zrevrange.mockResolvedValue([]);
      prisma.streak.findMany
        .mockResolvedValueOnce([{ userId: 'u1', currentStreak: 7, totalCheckins: 30 }]) // DB fallback
        .mockResolvedValueOnce([{ userId: 'u1', currentStreak: 7, totalCheckins: 30 }]); // per-user stats
      prisma.user.findMany.mockResolvedValue([alice]);

      const { entries } = await service.getLeaderboard('caller', 'store1');

      expect(entries).toHaveLength(1);
      expect(entries[0].currentStreak).toBe(7);
    });

    it('excludes non-discoverable users (except the caller themselves)', async () => {
      const hidden = {
        id: 'u3',
        displayName: 'Ghost',
        avatarUrl: null,
        avatarColors: [],
        privacySettings: { discoverable: false },
      };
      const callerUser = {
        id: 'caller',
        displayName: 'Me',
        avatarUrl: null,
        avatarColors: [],
        privacySettings: { discoverable: false },
      };
      redis.zrevrange.mockResolvedValue(['u1', '5', 'u3', '4', 'caller', '3']);
      prisma.user.findMany.mockResolvedValue([alice, hidden, callerUser]);
      prisma.streak.findMany.mockResolvedValue([
        { userId: 'u1', currentStreak: 5, totalCheckins: 20 },
        { userId: 'caller', currentStreak: 3, totalCheckins: 8 },
      ]);

      const { entries } = await service.getLeaderboard('caller', 'store1');

      const ids = entries.map((e) => e.userId);
      expect(ids).toContain('u1'); // discoverable → included
      expect(ids).not.toContain('u3'); // non-discoverable, not caller → excluded
      expect(ids).toContain('caller'); // non-discoverable but IS caller → included
    });

    it('returns myEntry with rank and stats when caller appears in the ranked list', async () => {
      redis.zrevrange.mockResolvedValue(['u1', '5', 'caller', '3']);
      prisma.user.findMany.mockResolvedValue([
        alice,
        { ...alice, id: 'caller', displayName: 'Me' },
      ]);
      prisma.streak.findMany.mockResolvedValue([
        { userId: 'u1', currentStreak: 5, totalCheckins: 20 },
        { userId: 'caller', currentStreak: 3, totalCheckins: 12 },
      ]);

      const { myEntry } = await service.getLeaderboard('caller', 'store1');

      expect(myEntry).not.toBeNull();
      expect(myEntry!.rank).toBe(2);
      expect(myEntry!.currentStreak).toBe(3);
      expect(myEntry!.totalCheckins).toBe(12);
    });

    it('returns myEntry: null when the caller has no streak for this store', async () => {
      redis.zrevrange.mockResolvedValue(['u1', '5']);
      prisma.user.findMany.mockResolvedValue([alice]);
      prisma.streak.findMany.mockResolvedValue([
        { userId: 'u1', currentStreak: 5, totalCheckins: 20 },
      ]);

      const { myEntry } = await service.getLeaderboard('caller', 'store1');

      expect(myEntry).toBeNull();
    });

    it('returns empty entries and null myEntry when no users are ranked', async () => {
      redis.zrevrange.mockResolvedValue([]);
      prisma.streak.findMany.mockResolvedValue([]);

      const result = await service.getLeaderboard('caller', 'store1');

      expect(result.entries).toHaveLength(0);
      expect(result.myEntry).toBeNull();
    });
  });
});
