import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GameStatus } from '@prisma/client';
import { EndorsementsService } from '../endorsements.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../../safety/safety.service';

function makePrismaMock() {
  return {
    gameLog: {
      findUnique: jest.fn(),
    },
    endorsement: {
      upsert: jest.fn(),
      groupBy: jest.fn(),
    },
  };
}

function makeGameRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game1',
    status: GameStatus.CONFIRMED,
    players: [
      { userId: 'caller', confirmed: true },
      { userId: 'peer1', confirmed: true },
    ],
    ...overrides,
  };
}

describe('EndorsementsService', () => {
  let service: EndorsementsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let safety: { getBlockedIds: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    safety = { getBlockedIds: jest.fn().mockResolvedValue(new Set()) };

    const module = await Test.createTestingModule({
      providers: [
        EndorsementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SafetyService, useValue: safety },
      ],
    }).compile();

    service = module.get(EndorsementsService);
  });

  // -------------------------------------------------------------------------
  // endorse
  // -------------------------------------------------------------------------

  describe('endorse', () => {
    it('throws BadRequestException when endorsing yourself', async () => {
      await expect(
        service.endorse('caller', 'game1', { toUserId: 'caller', tag: 'GOOD_SPORT' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the game does not exist', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(null);
      await expect(
        service.endorse('caller', 'game1', { toUserId: 'peer1', tag: 'GOOD_SPORT' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the game is not CONFIRMED', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(makeGameRow({ status: GameStatus.PENDING }));
      await expect(
        service.endorse('caller', 'game1', { toUserId: 'peer1', tag: 'GOOD_SPORT' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when the caller was not a confirmed player', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makeGameRow({ players: [{ userId: 'peer1', confirmed: true }] }),
      );
      await expect(
        service.endorse('caller', 'game1', { toUserId: 'peer1', tag: 'GOOD_SPORT' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the target was not a confirmed player', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(
        makeGameRow({
          players: [
            { userId: 'caller', confirmed: true },
            { userId: 'peer1', confirmed: false },
          ],
        }),
      );
      await expect(
        service.endorse('caller', 'game1', { toUserId: 'peer1', tag: 'GOOD_SPORT' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when the target is blocked', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(makeGameRow());
      safety.getBlockedIds.mockResolvedValue(new Set(['peer1']));
      await expect(
        service.endorse('caller', 'game1', { toUserId: 'peer1', tag: 'GOOD_SPORT' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('upserts the endorsement on success', async () => {
      prisma.gameLog.findUnique.mockResolvedValue(makeGameRow());
      prisma.endorsement.upsert.mockResolvedValue({});

      const result = await service.endorse('caller', 'game1', {
        toUserId: 'peer1',
        tag: 'GREAT_HOST',
      });

      expect(prisma.endorsement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            fromUserId_toUserId_gameLogId: {
              fromUserId: 'caller',
              toUserId: 'peer1',
              gameLogId: 'game1',
            },
          },
          create: {
            fromUserId: 'caller',
            toUserId: 'peer1',
            gameLogId: 'game1',
            tag: 'GREAT_HOST',
          },
          update: { tag: 'GREAT_HOST' },
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  // -------------------------------------------------------------------------
  // getSummary
  // -------------------------------------------------------------------------

  describe('getSummary', () => {
    it('returns zero total when there are no endorsements', async () => {
      prisma.endorsement.groupBy.mockResolvedValue([]);
      await expect(service.getSummary('peer1')).resolves.toEqual({ total: 0, byTag: [] });
    });

    it('shapes groupBy rows into byTag counts and a total', async () => {
      prisma.endorsement.groupBy.mockResolvedValue([
        { tag: 'GREAT_HOST', _count: { _all: 3 } },
        { tag: 'GOOD_SPORT', _count: { _all: 2 } },
      ]);

      const result = await service.getSummary('peer1');

      expect(result).toEqual({
        total: 5,
        byTag: [
          { tag: 'GREAT_HOST', count: 3 },
          { tag: 'GOOD_SPORT', count: 2 },
        ],
      });
    });

    it('excludes endorsers blocked by the target', async () => {
      safety.getBlockedIds.mockResolvedValue(new Set(['blocked1']));
      prisma.endorsement.groupBy.mockResolvedValue([]);

      await service.getSummary('peer1');

      expect(prisma.endorsement.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ fromUserId: { notIn: ['blocked1'] } }),
        }),
      );
    });
  });
});
