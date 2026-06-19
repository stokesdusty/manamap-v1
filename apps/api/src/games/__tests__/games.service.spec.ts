import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EncounterResult, EncounterSource, GameStatus, ModerationStatus, NotificationKind } from '@prisma/client';
import { GamesService } from '../games.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../../safety/safety.service';
import { GamificationService } from '../../gamification/gamification.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { QuestsService } from '../../quests/quests.service';
import type { CreateGame } from '@manamap/shared';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makePrismaMock() {
  return {
    $transaction: jest.fn(),
    gameLog: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    gamePlayer: {
      update: jest.fn(),
      createMany: jest.fn(),
    },
    encounter: {
      createMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };
}

/** A shaped game row as returned by fetchGame (prisma.gameLog.findUnique with include). */
function makeGameRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game1',
    status: GameStatus.PENDING,
    storeId: null,
    format: null,
    winnerId: 'creator',
    note: null,
    createdById: 'creator',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    confirmedAt: null,
    store: null,
    winner: { id: 'creator', displayName: 'Creator' },
    players: [
      {
        id: 'gp1',
        gameLogId: 'game1',
        userId: 'creator',
        deck: null,
        confirmed: true,
        user: { id: 'creator', displayName: 'Creator', avatarColors: [] },
      },
      {
        id: 'gp2',
        gameLogId: 'game1',
        userId: 'other',
        deck: null,
        confirmed: false,
        user: { id: 'other', displayName: 'Other', avatarColors: [] },
      },
    ],
    ...overrides,
  };
}

/** A PENDING game row as returned by gameLog.findUnique({ include: { players: true } }). */
function makePendingGameRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game1',
    status: GameStatus.PENDING,
    storeId: null,
    winnerId: 'creator',
    createdById: 'creator',
    players: [
      { id: 'gp1', userId: 'creator', confirmed: true },
      { id: 'gp2', userId: 'other',   confirmed: false },
    ],
    ...overrides,
  };
}

/** Valid CreateGame DTO with creator and one other player. */
const BASE_DTO: CreateGame = {
  players: [
    { userId: 'creator' },
    { userId: 'other' },
  ],
  winnerId: 'creator',
};

/** Active user rows returned by prisma.user.findMany. */
const ACTIVE_USERS = [
  { id: 'creator', displayName: 'Creator', moderationStatus: ModerationStatus.ACTIVE },
  { id: 'other',   displayName: 'Other',   moderationStatus: ModerationStatus.ACTIVE },
];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('GamesService', () => {
  let service: GamesService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let safety: { getBlockedIds: jest.Mock };
  let gamification: { refreshWinsLeaderboard: jest.Mock };
  let notifications: { create: jest.Mock };
  let quests: { evaluate: jest.Mock };

  beforeEach(async () => {
    prisma       = makePrismaMock();
    safety       = { getBlockedIds: jest.fn().mockResolvedValue(new Set()) };
    gamification = { refreshWinsLeaderboard: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    quests       = { evaluate: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: PrismaService,       useValue: prisma },
        { provide: SafetyService,       useValue: safety },
        { provide: GamificationService, useValue: gamification },
        { provide: NotificationsService, useValue: notifications },
        { provide: QuestsService,       useValue: quests },
      ],
    }).compile();

    service = module.get(GamesService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    /** Wire up the happy-path prisma mocks for create. */
    function setupCreate(txGameLogId = 'game1') {
      const tx = {
        gameLog:    { create: jest.fn().mockResolvedValue({ id: txGameLogId }) },
        gamePlayer: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));
      prisma.gameLog.findUnique.mockResolvedValue(makeGameRow());
      return tx;
    }

    it('throws creator_not_in_roster when creator is absent from the player list', async () => {
      const dto: CreateGame = { ...BASE_DTO, players: [{ userId: 'other' }] };
      await expect(service.create('creator', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws winner_not_in_roster when winnerId is not in the player list', async () => {
      const dto: CreateGame = { ...BASE_DTO, winnerId: 'ghost' };
      await expect(service.create('creator', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws duplicate_players when the same userId appears twice', async () => {
      const dto: CreateGame = {
        ...BASE_DTO,
        players: [{ userId: 'creator' }, { userId: 'creator' }],
        winnerId: 'creator',
      };
      await expect(service.create('creator', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws invalid_players when a player userId does not exist in the DB', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'creator', displayName: 'Creator', moderationStatus: ModerationStatus.ACTIVE },
        // 'other' is missing — only 1 of 2 found
      ]);
      safety.getBlockedIds.mockResolvedValue(new Set());
      await expect(service.create('creator', BASE_DTO)).rejects.toThrow(BadRequestException);
    });

    it('throws blocked_player when a non-creator player is blocked', async () => {
      prisma.user.findMany.mockResolvedValue(ACTIVE_USERS);
      safety.getBlockedIds.mockResolvedValue(new Set(['other']));
      await expect(service.create('creator', BASE_DTO)).rejects.toThrow(BadRequestException);
    });

    it('does not reject the creator even when the creator appears in the blocked set', async () => {
      // Creator blocking themselves would be impossible, but the guard skips creator entirely.
      // Ensure a clean run when only the creator is in the blocked set.
      prisma.user.findMany.mockResolvedValue(ACTIVE_USERS);
      safety.getBlockedIds.mockResolvedValue(new Set(['creator']));
      setupCreate();
      await expect(service.create('creator', BASE_DTO)).resolves.toBeDefined();
    });

    it('throws inactive_player when a non-creator player is not ACTIVE', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'creator', displayName: 'Creator', moderationStatus: ModerationStatus.ACTIVE },
        { id: 'other',   displayName: 'Other',   moderationStatus: ModerationStatus.BANNED },
      ]);
      safety.getBlockedIds.mockResolvedValue(new Set());
      await expect(service.create('creator', BASE_DTO)).rejects.toThrow(BadRequestException);
    });

    it('creates the game log and player rows inside a transaction', async () => {
      prisma.user.findMany.mockResolvedValue(ACTIVE_USERS);
      const tx = setupCreate();

      await service.create('creator', BASE_DTO);

      expect(tx.gameLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ createdById: 'creator', winnerId: 'creator' }) }),
      );
      expect(tx.gamePlayer.createMany).toHaveBeenCalled();
    });

    it('auto-confirms the creator and leaves others unconfirmed', async () => {
      prisma.user.findMany.mockResolvedValue(ACTIVE_USERS);
      const tx = setupCreate();

      await service.create('creator', BASE_DTO);

      const players: Array<{ userId: string; confirmed: boolean }> =
        tx.gamePlayer.createMany.mock.calls[0][0].data;
      const creator = players.find((p) => p.userId === 'creator');
      const other   = players.find((p) => p.userId === 'other');
      expect(creator?.confirmed).toBe(true);
      expect(other?.confirmed).toBe(false);
    });

    it('sends a game_confirm notification to every non-creator player', async () => {
      prisma.user.findMany.mockResolvedValue(ACTIVE_USERS);
      setupCreate();

      await service.create('creator', BASE_DTO);

      // Notification must go to 'other' but NOT to 'creator'
      expect(notifications.create).toHaveBeenCalledWith(
        'other',
        expect.objectContaining({ kind: NotificationKind.GAME_CONFIRM }),
      );
      const recipientIds = notifications.create.mock.calls.map((c: [string, unknown]) => c[0]);
      expect(recipientIds).not.toContain('creator');
    });

    it('returns a shaped game object', async () => {
      prisma.user.findMany.mockResolvedValue(ACTIVE_USERS);
      setupCreate();

      const result = await service.create('creator', BASE_DTO);

      expect(result).toMatchObject({
        id: 'game1',
        status: GameStatus.PENDING,
        winnerId: 'creator',
        players: expect.arrayContaining([
          expect.objectContaining({ userId: 'creator', confirmed: true }),
          expect.objectContaining({ userId: 'other',   confirmed: false }),
        ]),
      });
    });
  });

  // -------------------------------------------------------------------------
  // confirm
  // -------------------------------------------------------------------------

  describe('confirm', () => {
    it('throws NotFoundException when the game does not exist', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(null);
      await expect(service.confirm('caller', 'game1')).rejects.toThrow(NotFoundException);
    });

    it('throws game_not_pending when the game is already CONFIRMED', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({ status: GameStatus.CONFIRMED }),
      );
      await expect(service.confirm('caller', 'game1')).rejects.toThrow(BadRequestException);
    });

    it('throws game_not_pending when the game is DISPUTED', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({ status: GameStatus.DISPUTED }),
      );
      await expect(service.confirm('caller', 'game1')).rejects.toThrow(BadRequestException);
    });

    it('throws not_in_game when the caller is not a player', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(makePendingGameRow());
      await expect(service.confirm('outsider', 'game1')).rejects.toThrow(ForbiddenException);
    });

    it('marks the caller as confirmed and returns allConfirmed: false when others remain', async () => {
      // Both players start unconfirmed so confirming 'creator' still leaves 'other' pending.
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({
          players: [
            { id: 'gp1', userId: 'creator', confirmed: false },
            { id: 'gp2', userId: 'other',   confirmed: false },
          ],
        }),
      );
      prisma.gamePlayer.update.mockResolvedValue({});

      const result = await service.confirm('creator', 'game1');

      expect(prisma.gamePlayer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'gp1' }, data: { confirmed: true } }),
      );
      expect(result).toEqual({ success: true, allConfirmed: false });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('sets status to CONFIRMED and writes encounter rows when the last player confirms', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({
          // creator was already confirmed; 'other' confirming now completes it
          players: [
            { id: 'gp1', userId: 'creator', confirmed: true },
            { id: 'gp2', userId: 'other',   confirmed: false },
          ],
        }),
      );
      prisma.gamePlayer.update.mockResolvedValue({});
      prisma.gameLog.update.mockResolvedValue({});
      prisma.encounter.createMany.mockResolvedValue({ count: 2 });
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.confirm('other', 'game1');

      expect(result).toEqual({ success: true, allConfirmed: true });

      expect(prisma.gameLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'game1' },
          data: expect.objectContaining({ status: GameStatus.CONFIRMED, confirmedAt: expect.any(Date) }),
        }),
      );

      // WIN row for winner, LOSS row for loser
      const encounterData: unknown[] =
        prisma.encounter.createMany.mock.calls[0][0].data;
      expect(encounterData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'creator', opponentId: 'other', result: EncounterResult.WIN,  source: EncounterSource.GAME }),
          expect.objectContaining({ userId: 'other',   opponentId: 'creator', result: EncounterResult.LOSS, source: EncounterSource.GAME }),
        ]),
      );
    });

    it('calls refreshWinsLeaderboard when the confirmed game has a storeId', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({
          storeId: 'store1',
          players: [
            { id: 'gp1', userId: 'creator', confirmed: true },
            { id: 'gp2', userId: 'other',   confirmed: false },
          ],
        }),
      );
      prisma.gamePlayer.update.mockResolvedValue({});
      prisma.gameLog.update.mockResolvedValue({});
      prisma.encounter.createMany.mockResolvedValue({ count: 2 });
      prisma.$transaction.mockResolvedValue([]);

      await service.confirm('other', 'game1');

      expect(gamification.refreshWinsLeaderboard).toHaveBeenCalledWith('store1');
    });

    it('does not call refreshWinsLeaderboard when the game has no store', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({
          storeId: null,
          players: [
            { id: 'gp1', userId: 'creator', confirmed: true },
            { id: 'gp2', userId: 'other',   confirmed: false },
          ],
        }),
      );
      prisma.gamePlayer.update.mockResolvedValue({});
      prisma.gameLog.update.mockResolvedValue({});
      prisma.encounter.createMany.mockResolvedValue({ count: 2 });
      prisma.$transaction.mockResolvedValue([]);

      await service.confirm('other', 'game1');

      expect(gamification.refreshWinsLeaderboard).not.toHaveBeenCalled();
    });

    it('calls quests.evaluate for every player on final confirmation', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({
          players: [
            { id: 'gp1', userId: 'creator', confirmed: true },
            { id: 'gp2', userId: 'other',   confirmed: false },
          ],
        }),
      );
      prisma.gamePlayer.update.mockResolvedValue({});
      prisma.gameLog.update.mockResolvedValue({});
      prisma.encounter.createMany.mockResolvedValue({ count: 2 });
      prisma.$transaction.mockResolvedValue([]);

      await service.confirm('other', 'game1');

      const evaluatedIds = quests.evaluate.mock.calls.map((c: [string]) => c[0]);
      expect(evaluatedIds).toContain('creator');
      expect(evaluatedIds).toContain('other');
    });

    it('writes one WIN row and one LOSS row per loser in a multi-player game', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({
          winnerId: 'p1',
          players: [
            { id: 'gp1', userId: 'p1', confirmed: true },
            { id: 'gp2', userId: 'p2', confirmed: true },
            { id: 'gp3', userId: 'p3', confirmed: false },
          ],
        }),
      );
      prisma.gamePlayer.update.mockResolvedValue({});
      prisma.gameLog.update.mockResolvedValue({});
      prisma.encounter.createMany.mockResolvedValue({ count: 4 });
      prisma.$transaction.mockResolvedValue([]);

      await service.confirm('p3', 'game1');

      const data: unknown[] = prisma.encounter.createMany.mock.calls[0][0].data;
      // 2 losers → 2 WIN rows + 2 LOSS rows = 4 total
      expect(data).toHaveLength(4);
      expect(data.filter((e: unknown) => (e as { result: string }).result === EncounterResult.WIN)).toHaveLength(2);
      expect(data.filter((e: unknown) => (e as { result: string }).result === EncounterResult.LOSS)).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // dispute
  // -------------------------------------------------------------------------

  describe('dispute', () => {
    it('throws NotFoundException when the game does not exist', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(null);
      await expect(service.dispute('caller', 'game1')).rejects.toThrow(NotFoundException);
    });

    it('throws game_not_pending when the game is already CONFIRMED', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({ status: GameStatus.CONFIRMED }),
      );
      await expect(service.dispute('creator', 'game1')).rejects.toThrow(BadRequestException);
    });

    it('throws not_in_game when the caller is not a player', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(makePendingGameRow());
      await expect(service.dispute('outsider', 'game1')).rejects.toThrow(ForbiddenException);
    });

    it('sets the game status to DISPUTED', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(makePendingGameRow());
      prisma.gameLog.update.mockResolvedValue({});

      await service.dispute('other', 'game1');

      expect(prisma.gameLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'game1' },
          data: { status: GameStatus.DISPUTED },
        }),
      );
    });

    it('returns { success: true }', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(makePendingGameRow());
      prisma.gameLog.update.mockResolvedValue({});

      const result = await service.dispute('other', 'game1');

      expect(result).toEqual({ success: true });
    });

    it('notifies the creator when the disputer is a different player', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({ createdById: 'creator' }),
      );
      prisma.gameLog.update.mockResolvedValue({});

      await service.dispute('other', 'game1');

      expect(notifications.create).toHaveBeenCalledWith(
        'creator',
        expect.objectContaining({ data: expect.objectContaining({ type: 'game_disputed', gameId: 'game1' }) }),
      );
    });

    it('does not notify anyone when the creator disputes their own game', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makePendingGameRow({ createdById: 'creator' }),
      );
      prisma.gameLog.update.mockResolvedValue({});

      await service.dispute('creator', 'game1');

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
