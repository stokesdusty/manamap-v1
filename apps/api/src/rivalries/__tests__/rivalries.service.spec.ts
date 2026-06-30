import { Test } from '@nestjs/testing';
import { EncounterResult, EncounterSource, ModerationStatus } from '@prisma/client';
import { RivalriesService } from '../rivalries.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../../safety/safety.service';

function makePrismaMock() {
  return {
    encounter: { findMany: jest.fn() },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
}

function makeSafetyMock() {
  return { getBlockedIds: jest.fn().mockResolvedValue(new Set<string>()) };
}

function makeEncounter(overrides: Record<string, unknown> = {}) {
  return {
    opponentId: 'opp1',
    result: EncounterResult.WIN,
    gameId: 'game1',
    createdAt: new Date('2026-06-01T12:00:00Z'),
    source: EncounterSource.GAME,
    ...overrides,
  };
}

function makeOpponent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opp1',
    displayName: 'Opponent',
    pronouns: null,
    bio: null,
    avatarColors: ['red'],
    commander: 'Atraxa',
    powerLevel: 7,
    vibes: [],
    formats: ['commander'],
    ...overrides,
  };
}

describe('RivalriesService', () => {
  let service: RivalriesService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let safety: ReturnType<typeof makeSafetyMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    safety = makeSafetyMock();

    const module = await Test.createTestingModule({
      providers: [
        RivalriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: SafetyService, useValue: safety },
      ],
    }).compile();

    service = module.get(RivalriesService);
  });

  // -------------------------------------------------------------------------
  // getMyRivalries
  // -------------------------------------------------------------------------

  describe('getMyRivalries', () => {
    it('returns shaped rivalry with correct win/loss counts', async () => {
      prisma.encounter.findMany.mockResolvedValue([
        makeEncounter({ result: EncounterResult.WIN, gameId: 'g1' }),
        makeEncounter({ result: EncounterResult.LOSS, gameId: 'g2' }),
        makeEncounter({ result: EncounterResult.WIN, gameId: 'g3' }),
      ]);
      prisma.user.findMany.mockResolvedValue([makeOpponent()]);

      const result = await service.getMyRivalries('u1');

      expect(result).toHaveLength(1);
      expect(result[0].wins).toBe(2);
      expect(result[0].losses).toBe(1);
      expect(result[0].gamesTogether).toBe(3);
      expect(result[0].record).toBe('2–1');
    });

    it('deduplicates game IDs so the same game is not counted twice', async () => {
      prisma.encounter.findMany.mockResolvedValue([
        makeEncounter({ gameId: 'g1' }),
        makeEncounter({ gameId: 'g1' }), // duplicate
      ]);
      prisma.user.findMany.mockResolvedValue([makeOpponent()]);

      const result = await service.getMyRivalries('u1');

      expect(result[0].gamesTogether).toBe(1);
    });

    it('marks rivalry as hot when 3 or more games were played in the last 30 days', async () => {
      const recent = new Date(); // definitely within 30 days
      prisma.encounter.findMany.mockResolvedValue([
        makeEncounter({ gameId: 'g1', createdAt: recent }),
        makeEncounter({ gameId: 'g2', createdAt: recent }),
        makeEncounter({ gameId: 'g3', createdAt: recent }),
      ]);
      prisma.user.findMany.mockResolvedValue([makeOpponent()]);

      const result = await service.getMyRivalries('u1');
      expect(result[0].hot).toBe(true);
    });

    it('does not mark rivalry as hot when fewer than 3 recent games', async () => {
      const recent = new Date();
      prisma.encounter.findMany.mockResolvedValue([
        makeEncounter({ gameId: 'g1', createdAt: recent }),
        makeEncounter({ gameId: 'g2', createdAt: recent }),
      ]);
      prisma.user.findMany.mockResolvedValue([makeOpponent()]);

      const result = await service.getMyRivalries('u1');
      expect(result[0].hot).toBe(false);
    });

    it('excludes blocked opponents from results', async () => {
      safety.getBlockedIds.mockResolvedValue(new Set(['opp1']));
      prisma.encounter.findMany.mockResolvedValue([makeEncounter()]);
      prisma.user.findMany.mockResolvedValue([]); // candidateIds is empty → DB returns nothing

      const result = await service.getMyRivalries('u1');
      expect(result).toHaveLength(0);
    });

    it('sorts by gamesTogether descending, then lastPlayedAt descending', async () => {
      const earlier = new Date('2026-01-01T00:00:00Z');
      const later = new Date('2026-06-01T00:00:00Z');
      prisma.encounter.findMany.mockResolvedValue([
        makeEncounter({ opponentId: 'oppA', gameId: 'g1', createdAt: earlier }),
        makeEncounter({ opponentId: 'oppB', gameId: 'g2', createdAt: later }),
        makeEncounter({ opponentId: 'oppB', gameId: 'g3', createdAt: later }),
      ]);
      prisma.user.findMany.mockResolvedValue([
        makeOpponent({ id: 'oppA', displayName: 'A' }),
        makeOpponent({ id: 'oppB', displayName: 'B' }),
      ]);

      const result = await service.getMyRivalries('u1');
      expect(result[0].opponentId).toBe('oppB'); // 2 games > 1 game
    });

    it('returns empty array when there are no encounters', async () => {
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getMyRivalries('u1');
      expect(result).toHaveLength(0);
    });

    it('respects the limit parameter (max 20)', async () => {
      const encounters = Array.from({ length: 25 }, (_, i) =>
        makeEncounter({ opponentId: `opp${i}`, gameId: `g${i}` }),
      );
      const opponents = Array.from({ length: 25 }, (_, i) =>
        makeOpponent({ id: `opp${i}`, displayName: `Opp${i}` }),
      );
      prisma.encounter.findMany.mockResolvedValue(encounters);
      prisma.user.findMany.mockResolvedValue(opponents);

      const result = await service.getMyRivalries('u1', 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  // -------------------------------------------------------------------------
  // getRivalryDetail
  // -------------------------------------------------------------------------

  describe('getRivalryDetail', () => {
    it('returns null when opponent is blocked', async () => {
      safety.getBlockedIds.mockResolvedValue(new Set(['opp1']));
      prisma.encounter.findMany.mockResolvedValue([makeEncounter()]);

      const result = await service.getRivalryDetail('u1', 'opp1');
      expect(result).toBeNull();
    });

    it('returns null when there are no game encounters with the opponent', async () => {
      prisma.encounter.findMany.mockResolvedValue([]);

      const result = await service.getRivalryDetail('u1', 'opp1');
      expect(result).toBeNull();
    });

    it('returns null when opponent user record is not found or is not ACTIVE', async () => {
      prisma.encounter.findMany.mockResolvedValue([makeEncounter()]);
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.getRivalryDetail('u1', 'opp1');
      expect(result).toBeNull();
    });

    it('returns shaped rivalry detail when opponent is active', async () => {
      prisma.encounter.findMany.mockResolvedValue([makeEncounter({ result: EncounterResult.WIN })]);
      prisma.user.findFirst.mockResolvedValue(makeOpponent());

      const result = await service.getRivalryDetail('u1', 'opp1');

      expect(result).not.toBeNull();
      expect(result!.opponentId).toBe('opp1');
      expect(result!.wins).toBe(1);
      expect(result!.losses).toBe(0);
    });

    it('queries user with ACTIVE moderation status filter', async () => {
      prisma.encounter.findMany.mockResolvedValue([makeEncounter()]);
      prisma.user.findFirst.mockResolvedValue(makeOpponent());

      await service.getRivalryDetail('u1', 'opp1');

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ moderationStatus: ModerationStatus.ACTIVE }),
        }),
      );
    });
  });
});
