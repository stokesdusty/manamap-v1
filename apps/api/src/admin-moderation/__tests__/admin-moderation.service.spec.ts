import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConnectionStatus, ModerationStatus, ReportStatus } from '@prisma/client';
import { AdminModerationService } from '../admin-moderation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';

function makePrismaMock() {
  return {
    $transaction: jest.fn(),
    report: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    moderationAction: {
      create: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    connection: {
      deleteMany: jest.fn(),
    },
  };
}

function makeRedisMock() {
  return {
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
  };
}

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report1',
    reportedId: 'target1',
    status: ReportStatus.OPEN,
    reason: 'HARASSMENT',
    detail: null,
    context: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    resolvedAt: null,
    resolutionNote: null,
    reported: {
      id: 'target1',
      displayName: 'Target',
      avatarColors: [],
      moderationStatus: ModerationStatus.ACTIVE,
      identities: [{ discordHandle: 'target#0001' }],
      reportsAgainst: [],
      targetedActions: [],
    },
    ...overrides,
  };
}

describe('AdminModerationService', () => {
  let service: AdminModerationService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    redis = makeRedisMock();

    const module = await Test.createTestingModule({
      providers: [
        AdminModerationService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS,         useValue: redis },
      ],
    }).compile();

    service = module.get(AdminModerationService);
  });

  // -------------------------------------------------------------------------
  // getStats
  // -------------------------------------------------------------------------

  describe('getStats', () => {
    it('returns counts for open, reviewed, and actioned reports', async () => {
      prisma.report.count
        .mockResolvedValueOnce(3)   // OPEN
        .mockResolvedValueOnce(5)   // REVIEWED
        .mockResolvedValueOnce(12); // ACTIONED
      prisma.report.findMany.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.open).toBe(3);
      expect(result.reviewed).toBe(5);
      expect(result.actionedAllTime).toBe(12);
    });

    it('counts repeat offenders as users with 3 or more open reports', async () => {
      prisma.report.count.mockResolvedValue(0);
      prisma.report.findMany.mockResolvedValue([
        { reportedId: 'u1' }, { reportedId: 'u2' }, { reportedId: 'u1' },
      ]);
      prisma.report.groupBy.mockResolvedValue([
        { reportedId: 'u1', _count: { id: 3 } }, // repeat offender
        { reportedId: 'u2', _count: { id: 1 } }, // not a repeat offender
      ]);

      const result = await service.getStats();
      expect(result.repeatOffenders).toBe(1);
    });

    it('does not call groupBy when there are no open reports', async () => {
      prisma.report.count.mockResolvedValue(0);
      prisma.report.findMany.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.repeatOffenders).toBe(0);
      expect(prisma.report.groupBy).not.toHaveBeenCalled();
    });

    it('does not count users with fewer than 3 reports as repeat offenders', async () => {
      prisma.report.count.mockResolvedValue(0);
      prisma.report.findMany.mockResolvedValue([{ reportedId: 'u1' }]);
      prisma.report.groupBy.mockResolvedValue([
        { reportedId: 'u1', _count: { id: 2 } },
      ]);

      const result = await service.getStats();
      expect(result.repeatOffenders).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getReport
  // -------------------------------------------------------------------------

  describe('getReport', () => {
    it('throws NotFoundException when the report does not exist', async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(service.getReport('ghost')).rejects.toThrow(NotFoundException);
    });

    it('builds open_report signals from other open reports this week', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      prisma.report.findMany.mockResolvedValue([
        { id: 'r2', reason: 'CHEATING', createdAt: new Date() },
      ]);

      const result = await service.getReport('report1');

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].type).toBe('open_report');
      expect(result.signals[0].label).toContain('cheating');
    });

    it('builds prior_action signals from the targeted actions history', async () => {
      prisma.report.findUnique.mockResolvedValue(
        makeReport({
          reported: {
            id: 'target1',
            displayName: 'Target',
            avatarColors: [],
            moderationStatus: ModerationStatus.ACTIVE,
            identities: [],
            reportsAgainst: [],
            targetedActions: [
              { id: 'a1', action: 'WARN', createdAt: new Date('2026-01-01') },
            ],
          },
        }),
      );
      prisma.report.findMany.mockResolvedValue([]);

      const result = await service.getReport('report1');

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].type).toBe('prior_action');
      expect(result.signals[0].label).toContain('Warn');
    });

    it('returns empty signals when there are no prior actions or open reports this week', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      prisma.report.findMany.mockResolvedValue([]);

      const result = await service.getReport('report1');
      expect(result.signals).toHaveLength(0);
    });

    it('never exposes the reporter identity (reporterId absent from response)', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      prisma.report.findMany.mockResolvedValue([]);

      const result = await service.getReport('report1');

      expect(result).not.toHaveProperty('reporterId');
      expect(result).not.toHaveProperty('reporter');
    });

    it('returns handle from first identity, null when identities are empty', async () => {
      prisma.report.findUnique.mockResolvedValue(
        makeReport({ reported: { ...makeReport().reported, identities: [] } }),
      );
      prisma.report.findMany.mockResolvedValue([]);

      const result = await service.getReport('report1');
      expect(result.reported.handle).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // resolveReport
  // -------------------------------------------------------------------------

  describe('resolveReport', () => {
    function setupResolve() {
      const tx = {
        report: { update: jest.fn().mockResolvedValue({}) },
        moderationAction: { create: jest.fn().mockResolvedValue({}) },
        user: { update: jest.fn().mockResolvedValue({}) },
        connection: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));
      return tx;
    }

    it('throws NotFoundException when the report does not exist', async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(service.resolveReport('ghost', 'admin1', { action: 'DISMISS' })).rejects.toThrow(NotFoundException);
    });

    it('sets status to REVIEWED for DISMISS action', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      const tx = setupResolve();

      await service.resolveReport('report1', 'admin1', { action: 'DISMISS' });

      expect(tx.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ReportStatus.REVIEWED }) }),
      );
    });

    it('sets status to ACTIONED for WARN action', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      const tx = setupResolve();

      await service.resolveReport('report1', 'admin1', { action: 'WARN' });

      expect(tx.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ReportStatus.ACTIONED }) }),
      );
    });

    it('creates an immutable ModerationAction audit log entry', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      const tx = setupResolve();

      await service.resolveReport('report1', 'admin1', { action: 'WARN', note: 'Final warning' });

      expect(tx.moderationAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reportId: 'report1',
            targetUserId: 'target1',
            adminId: 'admin1',
            action: 'WARN',
            note: 'Final warning',
          }),
        }),
      );
    });

    it('suspends the user for the given number of days on SUSPEND action', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      const tx = setupResolve();
      const before = new Date();

      await service.resolveReport('report1', 'admin1', { action: 'SUSPEND', suspendDays: 3 });

      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            moderationStatus: ModerationStatus.SUSPENDED,
            suspendedUntil: expect.any(Date),
          }),
        }),
      );
      const suspendedUntil: Date = tx.user.update.mock.calls[0][0].data.suspendedUntil;
      const expectedMs = 3 * 24 * 60 * 60 * 1000;
      expect(suspendedUntil.getTime() - before.getTime()).toBeGreaterThanOrEqual(expectedMs - 100);
    });

    it('defaults suspension to 7 days when suspendDays is not provided', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      const tx = setupResolve();
      const before = new Date();

      await service.resolveReport('report1', 'admin1', { action: 'SUSPEND' });

      const suspendedUntil: Date = tx.user.update.mock.calls[0][0].data.suspendedUntil;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(suspendedUntil.getTime() - before.getTime()).toBeGreaterThanOrEqual(sevenDaysMs - 100);
    });

    it('bans the user and deletes their pending connections on BAN action', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      const tx = setupResolve();

      await service.resolveReport('report1', 'admin1', { action: 'BAN' });

      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { moderationStatus: ModerationStatus.BANNED, suspendedUntil: null },
        }),
      );
      expect(tx.connection.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ConnectionStatus.PENDING }),
        }),
      );
    });

    it('withdraws Redis presence for SUSPEND action', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      setupResolve();
      redis.get.mockResolvedValue('store1');

      await service.resolveReport('report1', 'admin1', { action: 'SUSPEND' });

      expect(redis.del).toHaveBeenCalledWith('presence:target1');
      expect(redis.zrem).toHaveBeenCalledWith('store_members:store1', 'target1');
    });

    it('withdraws Redis presence for BAN action', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      setupResolve();
      redis.get.mockResolvedValue('store1');

      await service.resolveReport('report1', 'admin1', { action: 'BAN' });

      expect(redis.del).toHaveBeenCalledWith('presence:target1');
    });

    it('does not call del/zrem when user has no active presence', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      setupResolve();
      redis.get.mockResolvedValue(null); // no presence key

      await service.resolveReport('report1', 'admin1', { action: 'SUSPEND' });

      expect(redis.del).not.toHaveBeenCalled();
      expect(redis.zrem).not.toHaveBeenCalled();
    });

    it('does not modify user moderation status for DISMISS or WARN', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      const tx = setupResolve();

      await service.resolveReport('report1', 'admin1', { action: 'DISMISS' });
      expect(tx.user.update).not.toHaveBeenCalled();

      await service.resolveReport('report1', 'admin1', { action: 'WARN' });
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('returns { success: true }', async () => {
      prisma.report.findUnique.mockResolvedValue(makeReport());
      setupResolve();

      const result = await service.resolveReport('report1', 'admin1', { action: 'DISMISS' });
      expect(result).toEqual({ success: true });
    });
  });
});
