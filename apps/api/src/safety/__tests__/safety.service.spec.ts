import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SafetyService } from '../safety.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrismaMock() {
  return {
    block: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    connection: {
      deleteMany: jest.fn(),
    },
    report: {
      create: jest.fn(),
    },
  };
}

describe('SafetyService', () => {
  let service: SafetyService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();

    const module = await Test.createTestingModule({
      providers: [SafetyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SafetyService);
  });

  // ---------------------------------------------------------------------------
  // getBlockedIds — bidirectional
  // ---------------------------------------------------------------------------

  describe('getBlockedIds', () => {
    it('returns IDs the caller blocked', async () => {
      prisma.block.findMany.mockResolvedValue([
        { blockerId: 'alice', blockedId: 'bob' },
        { blockerId: 'alice', blockedId: 'carol' },
      ]);

      const ids = await service.getBlockedIds('alice');

      expect(ids.has('bob')).toBe(true);
      expect(ids.has('carol')).toBe(true);
    });

    it('returns IDs that have blocked the caller', async () => {
      prisma.block.findMany.mockResolvedValue([{ blockerId: 'dave', blockedId: 'alice' }]);

      const ids = await service.getBlockedIds('alice');

      expect(ids.has('dave')).toBe(true);
    });

    it('returns a bidirectional set when both directions exist', async () => {
      prisma.block.findMany.mockResolvedValue([
        { blockerId: 'alice', blockedId: 'bob' },
        { blockerId: 'carol', blockedId: 'alice' },
      ]);

      const ids = await service.getBlockedIds('alice');

      expect(ids.size).toBe(2);
      expect(ids.has('bob')).toBe(true);
      expect(ids.has('carol')).toBe(true);
    });

    it('returns empty set when no blocks exist', async () => {
      prisma.block.findMany.mockResolvedValue([]);

      const ids = await service.getBlockedIds('alice');

      expect(ids.size).toBe(0);
    });

    it('queries with both blockerId and blockedId for alice', async () => {
      prisma.block.findMany.mockResolvedValue([]);
      await service.getBlockedIds('alice');

      const where = prisma.block.findMany.mock.calls[0][0].where as Record<string, unknown>;
      expect(where).toMatchObject({
        OR: expect.arrayContaining([{ blockerId: 'alice' }, { blockedId: 'alice' }]),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // nearby / resolveToken integration — blocked IDs excluded
  // ---------------------------------------------------------------------------

  describe('block', () => {
    it('throws BadRequestException when blocking yourself', async () => {
      await expect(service.block('alice', 'alice')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when blocked user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.block('alice', 'unknown')).rejects.toThrow(NotFoundException);
    });

    it('upserts the block and deletes connections', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'bob' });
      prisma.block.upsert.mockResolvedValue({});
      prisma.connection.deleteMany.mockResolvedValue({ count: 1 });

      await service.block('alice', 'bob');

      expect(prisma.block.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { blockerId_blockedId: { blockerId: 'alice', blockedId: 'bob' } },
          create: { blockerId: 'alice', blockedId: 'bob' },
        }),
      );
      expect(prisma.connection.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  describe('unblock', () => {
    it('deletes the block record', async () => {
      prisma.block.deleteMany.mockResolvedValue({ count: 1 });

      await service.unblock('alice', 'bob');

      expect(prisma.block.deleteMany).toHaveBeenCalledWith({
        where: { blockerId: 'alice', blockedId: 'bob' },
      });
    });
  });
});
