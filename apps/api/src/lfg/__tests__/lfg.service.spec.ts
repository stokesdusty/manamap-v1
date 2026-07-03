import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LfgService } from '../lfg.service';
import type { LfgSession } from '../lfg.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';
import { SafetyService } from '../../safety/safety.service';
import { NotificationsService } from '../../notifications/notifications.service';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    encounter: { findMany: jest.fn(), createMany: jest.fn() },
  };
}

function makeRedisMock() {
  return {
    get: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    zadd: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(0),
  };
}

function makeSession(overrides: Partial<LfgSession> = {}): LfgSession {
  return {
    storeId: 'store1',
    format: null,
    power: 7,
    seats: 4,
    durationMins: 60,
    note: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function makeProfile(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    displayName: `User ${id}`,
    pronouns: null,
    bio: null,
    avatarColors: [],
    commander: null,
    powerLevel: 7,
    vibes: [],
    formats: [],
    privacySettings: { discoverable: true },
    ...overrides,
  };
}

describe('LfgService', () => {
  let service: LfgService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let safety: { getBlockedIds: jest.Mock };
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    safety = { getBlockedIds: jest.fn().mockResolvedValue(new Set()) };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        LfgService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS, useValue: redis },
        { provide: SafetyService, useValue: safety },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(LfgService);
  });

  // ---------------------------------------------------------------------------
  // getMySession()
  // ---------------------------------------------------------------------------

  describe('getMySession', () => {
    it('returns null when there is no active session', async () => {
      redis.get.mockResolvedValue(null);
      expect(await service.getMySession('u1')).toBeNull();
    });

    it('returns the parsed session', async () => {
      const session = makeSession();
      redis.get.mockResolvedValue(JSON.stringify(session));
      expect(await service.getMySession('u1')).toEqual(session);
    });
  });

  // ---------------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('throws ConflictException when the user is not checked in anywhere', async () => {
      redis.get.mockResolvedValue(null);
      await expect(
        service.create('u1', { power: 7, seats: 4, durationMins: 60 } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('persists a new session keyed by presence store and zadds the store index', async () => {
      redis.get.mockResolvedValue('store1');

      const session = await service.create('u1', { power: 7, seats: 4, durationMins: 30 } as any);

      expect(session.storeId).toBe('store1');
      expect(session.durationMins).toBe(30);
      expect(redis.setex).toHaveBeenCalledWith('lfg:u1', 30 * 60, expect.any(String));
      expect(redis.zadd).toHaveBeenCalledWith('lfg_store:store1', expect.any(Number), 'u1');
    });
  });

  // ---------------------------------------------------------------------------
  // update()
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('throws NotFoundException when there is no active session', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.update('u1', { power: 8 } as any)).rejects.toThrow(NotFoundException);
    });

    it('patches only the provided fields and keeps the existing TTL when duration is unchanged', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makeSession({ power: 7, durationMins: 60 })));

      const updated = await service.update('u1', { power: 9 } as any);

      expect(updated.power).toBe(9);
      expect(updated.durationMins).toBe(60);
      expect(redis.zadd).not.toHaveBeenCalled();
    });

    it('recomputes expiresAt and re-zadds the store index when duration changes', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makeSession({ storeId: 'store1', durationMins: 30 })));

      const updated = await service.update('u1', { durationMins: 120 } as any);

      expect(updated.durationMins).toBe(120);
      expect(redis.zadd).toHaveBeenCalledWith('lfg_store:store1', expect.any(Number), 'u1');
    });
  });

  // ---------------------------------------------------------------------------
  // remove()
  // ---------------------------------------------------------------------------

  describe('remove', () => {
    it('does nothing when there is no active session', async () => {
      redis.get.mockResolvedValue(null);
      await service.remove('u1');
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('deletes the session and removes it from the store index', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makeSession({ storeId: 'store1' })));
      await service.remove('u1');
      expect(redis.del).toHaveBeenCalledWith('lfg:u1');
      expect(redis.zrem).toHaveBeenCalledWith('lfg_store:store1', 'u1');
    });
  });

  // ---------------------------------------------------------------------------
  // feed()
  // ---------------------------------------------------------------------------

  describe('feed', () => {
    it('returns [] when the caller is not checked in anywhere', async () => {
      redis.get.mockResolvedValue(null);
      expect(await service.feed('caller1')).toEqual([]);
    });

    it('returns [] when the store LFG list has no other members', async () => {
      redis.get.mockResolvedValue('store1');
      redis.zrange.mockResolvedValue(['caller1']);
      expect(await service.feed('caller1')).toEqual([]);
    });

    it('excludes blocked users before pruning', async () => {
      redis.get.mockResolvedValue('store1');
      redis.zrange.mockResolvedValue(['blockedUser']);
      safety.getBlockedIds.mockResolvedValue(new Set(['blockedUser']));

      expect(await service.feed('caller1')).toEqual([]);
      expect(redis.exists).not.toHaveBeenCalled();
    });

    it('prunes expired LFG entries from the store index', async () => {
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key === 'presence:caller1' ? 'store1' : null),
      );
      redis.zrange.mockResolvedValue(['expiredUser']);
      redis.exists.mockResolvedValue(0);

      await service.feed('caller1');

      expect(redis.zrem).toHaveBeenCalledWith('lfg_store:store1', 'expiredUser');
    });

    it('excludes members who are no longer checked in at this store', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'presence:caller1') return Promise.resolve('store1');
        if (key === 'presence:member1') return Promise.resolve('otherStore');
        return Promise.resolve(null);
      });
      redis.zrange.mockResolvedValue(['member1']);
      redis.exists.mockResolvedValue(1);

      const result = await service.feed('caller1');
      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('returns present, discoverable members with session, minutesLeft, and metBefore', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'presence:caller1') return Promise.resolve('store1');
        if (key === 'presence:member1') return Promise.resolve('store1');
        if (key === 'lfg:member1') return Promise.resolve(JSON.stringify(makeSession({ storeId: 'store1' })));
        return Promise.resolve(null);
      });
      redis.zrange.mockResolvedValue(['member1']);
      redis.exists.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([makeProfile('member1')]);
      prisma.encounter.findMany.mockResolvedValue([{ userId: 'caller1', opponentId: 'member1' }]);

      const result = await service.feed('caller1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({ id: 'member1', metBefore: true, minutesLeft: expect.any(Number) }),
      );
    });

    it('excludes members who opted out of discoverability', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'presence:caller1') return Promise.resolve('store1');
        if (key === 'presence:member1') return Promise.resolve('store1');
        return Promise.resolve(null);
      });
      redis.zrange.mockResolvedValue(['member1']);
      redis.exists.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        makeProfile('member1', { privacySettings: { discoverable: false } }),
      ]);
      prisma.encounter.findMany.mockResolvedValue([]);

      expect(await service.feed('caller1')).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // invite()
  // ---------------------------------------------------------------------------

  describe('invite', () => {
    it('throws ForbiddenException when inviting yourself', async () => {
      await expect(service.invite('u1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the host has no active session', async () => {
      redis.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ displayName: 'Caller' });
      await expect(service.invite('caller1', 'host1')).rejects.toThrow(NotFoundException);
    });

    it('notifies the host on success', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makeSession()));
      prisma.user.findUnique.mockResolvedValue({ displayName: 'Caller' });

      const result = await service.invite('caller1', 'host1');

      expect(notifications.create).toHaveBeenCalledWith(
        'host1',
        expect.objectContaining({ kind: 'POD', data: { type: 'lfg_join_request', userId: 'caller1' } }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ---------------------------------------------------------------------------
  // lock()
  // ---------------------------------------------------------------------------

  describe('lock', () => {
    it('throws ForbiddenException when the caller is not the host', async () => {
      await expect(service.lock('notHost', 'host1', { memberIds: [] } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the host has no active session', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.lock('host1', 'host1', { memberIds: [] } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a draw encounter pair for every ordered pair of members, dedupes host duplication, and clears the session', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makeSession({ storeId: 'store1' })));
      prisma.encounter.createMany.mockResolvedValue({ count: 2 });

      const result = await service.lock('host1', 'host1', {
        memberIds: ['host1', 'member1'],
      } as any);

      expect(prisma.encounter.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'host1', opponentId: 'member1', storeId: 'store1', source: 'GAME', result: 'DRAW', notes: 'Pod formed via LFG' },
          { userId: 'member1', opponentId: 'host1', storeId: 'store1', source: 'GAME', result: 'DRAW', notes: 'Pod formed via LFG' },
        ],
        skipDuplicates: true,
      });
      expect(redis.del).toHaveBeenCalledWith('lfg:host1');
      expect(redis.zrem).toHaveBeenCalledWith('lfg_store:store1', 'host1');
      expect(result).toEqual({ success: true });
    });

    it('skips encounter creation when locking with no other members', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makeSession({ storeId: 'store1' })));
      await service.lock('host1', 'host1', { memberIds: [] } as any);
      expect(prisma.encounter.createMany).not.toHaveBeenCalled();
    });
  });
});
