import { Test } from '@nestjs/testing';
import { ConnectionStatus, GameStatus, NotificationKind } from '@prisma/client';
import { QuestsService } from '../quests.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

function makePrismaMock() {
  return {
    quest: { findMany: jest.fn() },
    questProgress: {
      findMany: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    userBadge: { create: jest.fn().mockResolvedValue({}) },
    connection: { count: jest.fn() },
    checkin: { findMany: jest.fn(), groupBy: jest.fn() },
    gameLog: { count: jest.fn() },
    streak: { findFirst: jest.fn() },
  };
}

function makeNotificationsMock() {
  return { create: jest.fn().mockResolvedValue({}) };
}

function makeQuest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    code: 'TEST_QUEST',
    title: 'Test Quest',
    description: null,
    icon: '🏆',
    period: 'MONTHLY',
    activeFrom: new Date('2026-06-01T00:00:00Z'),
    activeTo: new Date('2026-07-01T00:00:00Z'),
    criteria: { type: 'play_games', count: 3 },
    rewardBadge: null,
    ...overrides,
  };
}

describe('QuestsService', () => {
  let service: QuestsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();

    const module = await Test.createTestingModule({
      providers: [
        QuestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(QuestsService);
  });

  // -------------------------------------------------------------------------
  // getActiveQuests
  // -------------------------------------------------------------------------

  describe('getActiveQuests', () => {
    it('returns empty array when no active quests exist', async () => {
      prisma.quest.findMany.mockResolvedValue([]);
      const result = await service.getActiveQuests('u1');
      expect(result).toEqual([]);
      expect(prisma.questProgress.findMany).not.toHaveBeenCalled();
    });

    it('returns quest with progress 0 when no progress row exists', async () => {
      prisma.quest.findMany.mockResolvedValue([makeQuest()]);
      prisma.questProgress.findMany.mockResolvedValue([]);

      const result = await service.getActiveQuests('u1');

      expect(result).toHaveLength(1);
      expect(result[0].progress).toBe(0);
      expect(result[0].completed).toBe(false);
    });

    it('returns existing progress and completed flag', async () => {
      prisma.quest.findMany.mockResolvedValue([makeQuest()]);
      prisma.questProgress.findMany.mockResolvedValue([
        { questId: 'q1', progress: 3, completedAt: new Date() },
      ]);

      const result = await service.getActiveQuests('u1');

      expect(result[0].progress).toBe(3);
      expect(result[0].completed).toBe(true);
    });

    it('sets goal from play_games criteria count', async () => {
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ criteria: { type: 'play_games', count: 5 } }),
      ]);
      prisma.questProgress.findMany.mockResolvedValue([]);

      const result = await service.getActiveQuests('u1');
      expect(result[0].goal).toBe(5);
    });

    it('sets goal to 1 for new_store criteria', async () => {
      prisma.quest.findMany.mockResolvedValue([makeQuest({ criteria: { type: 'new_store' } })]);
      prisma.questProgress.findMany.mockResolvedValue([]);

      const result = await service.getActiveQuests('u1');
      expect(result[0].goal).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // evaluate — computeProgress branches
  // -------------------------------------------------------------------------

  describe('evaluate — computeProgress', () => {
    beforeEach(() => {
      prisma.questProgress.findMany.mockResolvedValue([]);
    });

    it('meet_new_players: counts accepted connections since quest start', async () => {
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ criteria: { type: 'meet_new_players', count: 3 } }),
      ]);
      prisma.connection.count.mockResolvedValue(2);

      await service.evaluate('u1');

      expect(prisma.connection.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ConnectionStatus.ACCEPTED }),
        }),
      );
      expect(prisma.questProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ progress: 2 }) }),
      );
    });

    it('play_games: counts confirmed games since quest start', async () => {
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ criteria: { type: 'play_games', count: 3 } }),
      ]);
      prisma.gameLog.count.mockResolvedValue(1);

      await service.evaluate('u1');

      expect(prisma.gameLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: GameStatus.CONFIRMED }),
        }),
      );
      expect(prisma.questProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ progress: 1 }) }),
      );
    });

    it('checkin_streak: uses best currentStreak across all stores', async () => {
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ criteria: { type: 'checkin_streak', length: 5 } }),
      ]);
      prisma.streak.findFirst.mockResolvedValue({ currentStreak: 4 });

      await service.evaluate('u1');

      expect(prisma.streak.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { currentStreak: 'desc' } }),
      );
      expect(prisma.questProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ progress: 4 }) }),
      );
    });

    it('checkin_streak: returns 0 when user has no streaks', async () => {
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ criteria: { type: 'checkin_streak', length: 5 } }),
      ]);
      prisma.streak.findFirst.mockResolvedValue(null);

      await service.evaluate('u1');

      expect(prisma.questProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ progress: 0 }) }),
      );
    });

    it('unique_stores: counts distinct stores visited since quest start', async () => {
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ criteria: { type: 'unique_stores', count: 3 } }),
      ]);
      prisma.checkin.groupBy.mockResolvedValue([{ storeId: 's1' }, { storeId: 's2' }]);

      await service.evaluate('u1');

      expect(prisma.questProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ progress: 2 }) }),
      );
    });

    it('new_store: returns 1 when user visited a store not visited before quest start', async () => {
      prisma.quest.findMany.mockResolvedValue([makeQuest({ criteria: { type: 'new_store' } })]);
      prisma.checkin.findMany
        .mockResolvedValueOnce([{ storeId: 'store1' }]) // checkins since quest start
        .mockResolvedValueOnce([]); // no prior visits

      await service.evaluate('u1');

      expect(prisma.questProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ progress: 1 }) }),
      );
    });

    it('new_store: returns 0 when store was already visited before quest start', async () => {
      prisma.quest.findMany.mockResolvedValue([makeQuest({ criteria: { type: 'new_store' } })]);
      prisma.checkin.findMany
        .mockResolvedValueOnce([{ storeId: 'store1' }]) // since quest
        .mockResolvedValueOnce([{ storeId: 'store1' }]); // prior visit — not new

      await service.evaluate('u1');

      expect(prisma.questProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ progress: 0 }) }),
      );
    });

    it('new_store: returns 0 when there are no checkins since quest start', async () => {
      prisma.quest.findMany.mockResolvedValue([makeQuest({ criteria: { type: 'new_store' } })]);
      prisma.checkin.findMany.mockResolvedValueOnce([]); // no checkins since quest

      await service.evaluate('u1');

      expect(prisma.questProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ progress: 0 }) }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // evaluate — progress create vs update
  // -------------------------------------------------------------------------

  describe('evaluate — progress persistence', () => {
    it('creates a new progress row when none exists', async () => {
      prisma.quest.findMany.mockResolvedValue([makeQuest()]);
      prisma.questProgress.findMany.mockResolvedValue([]);
      prisma.gameLog.count.mockResolvedValue(1);

      await service.evaluate('u1');

      expect(prisma.questProgress.create).toHaveBeenCalled();
      expect(prisma.questProgress.update).not.toHaveBeenCalled();
    });

    it('updates existing progress row when one exists', async () => {
      prisma.quest.findMany.mockResolvedValue([makeQuest()]);
      prisma.questProgress.findMany.mockResolvedValue([
        { id: 'prog1', questId: 'q1', progress: 1, completedAt: null },
      ]);
      prisma.gameLog.count.mockResolvedValue(2);

      await service.evaluate('u1');

      expect(prisma.questProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prog1' } }),
      );
      expect(prisma.questProgress.create).not.toHaveBeenCalled();
    });

    it('skips quests that are already completed', async () => {
      prisma.quest.findMany.mockResolvedValue([makeQuest()]);
      prisma.questProgress.findMany.mockResolvedValue([
        { id: 'prog1', questId: 'q1', progress: 3, completedAt: new Date() },
      ]);

      await service.evaluate('u1');

      expect(prisma.questProgress.update).not.toHaveBeenCalled();
      expect(prisma.questProgress.create).not.toHaveBeenCalled();
    });

    it('returns early when there are no active quests', async () => {
      prisma.quest.findMany.mockResolvedValue([]);

      await service.evaluate('u1');

      expect(prisma.questProgress.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // evaluate — completion side effects
  // -------------------------------------------------------------------------

  describe('evaluate — completion side effects', () => {
    it('sets completedAt when progress meets the goal', async () => {
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ criteria: { type: 'play_games', count: 3 } }),
      ]);
      prisma.questProgress.findMany.mockResolvedValue([]);
      prisma.gameLog.count.mockResolvedValue(3); // exactly meets goal

      await service.evaluate('u1');

      expect(prisma.questProgress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ completedAt: expect.any(Date) }),
        }),
      );
    });

    it('creates a UserBadge when quest has a rewardBadge and is completed', async () => {
      const rewardBadge = { id: 'badge1', code: 'QUEST_BADGE', name: 'Quester', icon: '🎖️' };
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ rewardBadge, criteria: { type: 'play_games', count: 1 } }),
      ]);
      prisma.questProgress.findMany.mockResolvedValue([]);
      prisma.gameLog.count.mockResolvedValue(1);

      await service.evaluate('u1');

      expect(prisma.userBadge.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: 'u1', badgeId: 'badge1' } }),
      );
    });

    it('does not throw when UserBadge creation fails (duplicate race condition)', async () => {
      const rewardBadge = { id: 'badge1', code: 'QUEST_BADGE', name: 'Quester', icon: '🎖️' };
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ rewardBadge, criteria: { type: 'play_games', count: 1 } }),
      ]);
      prisma.questProgress.findMany.mockResolvedValue([]);
      prisma.gameLog.count.mockResolvedValue(1);
      prisma.userBadge.create.mockRejectedValue(new Error('unique constraint'));

      await expect(service.evaluate('u1')).resolves.not.toThrow();
    });

    it('fires a QUEST notification on completion', async () => {
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ criteria: { type: 'play_games', count: 1 } }),
      ]);
      prisma.questProgress.findMany.mockResolvedValue([]);
      prisma.gameLog.count.mockResolvedValue(1);

      await service.evaluate('u1');

      expect(notifications.create).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ kind: NotificationKind.QUEST }),
      );
    });

    it('does not fire a notification when quest is not yet complete', async () => {
      prisma.quest.findMany.mockResolvedValue([
        makeQuest({ criteria: { type: 'play_games', count: 5 } }),
      ]);
      prisma.questProgress.findMany.mockResolvedValue([]);
      prisma.gameLog.count.mockResolvedValue(2); // below goal

      await service.evaluate('u1');

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
