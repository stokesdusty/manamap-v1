import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PodsService } from '../pods.service';
import type { PodSession } from '../pods.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';
import { SafetyService } from '../../safety/safety.service';
import { NotificationsService } from '../../notifications/notifications.service';

function makePrismaMock() {
  return {
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    encounter: { createMany: jest.fn() },
  };
}

function makeRedisMock() {
  return {
    get: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    sadd: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    zrange: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(0),
  };
}

function makePod(overrides: Partial<PodSession> = {}): PodSession {
  return {
    id: 'pod1',
    hostId: 'host1',
    storeId: 'store1',
    format: null,
    targetPower: 7,
    tolerance: 1,
    seats: 4,
    where: 'Table 3',
    note: null,
    memberIds: ['host1'],
    requestIds: [],
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
    formats: ['commander'],
    ...overrides,
  };
}

describe('PodsService', () => {
  let service: PodsService;
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
        PodsService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS, useValue: redis },
        { provide: SafetyService, useValue: safety },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(PodsService);
  });

  // ---------------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------------

  describe('create', () => {
    const dto = { targetPower: 7, tolerance: 1, seats: 4, where: 'Table 3' } as any;

    it('throws ConflictException when the user is not checked in anywhere', async () => {
      redis.get.mockImplementation((key: string) => Promise.resolve(key.startsWith('presence:') ? null : null));
      await expect(service.create('u1', dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when the user is already hosting a pod', async () => {
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key.startsWith('presence:') ? 'store1' : 'existing-pod'),
      );
      await expect(service.create('u1', dto)).rejects.toThrow(ConflictException);
    });

    it('creates and persists a new pod', async () => {
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key.startsWith('presence:') ? 'store1' : null),
      );

      const pod = await service.create('u1', dto);

      expect(pod.hostId).toBe('u1');
      expect(pod.storeId).toBe('store1');
      expect(pod.memberIds).toEqual(['u1']);
      expect(redis.setex).toHaveBeenCalledWith(`pod:${pod.id}`, 90 * 60, expect.any(String));
      expect(redis.sadd).toHaveBeenCalledWith('pod_store:store1', pod.id);
      expect(redis.setex).toHaveBeenCalledWith('user_pod:u1', 90 * 60, pod.id);
    });
  });

  // ---------------------------------------------------------------------------
  // feed()
  // ---------------------------------------------------------------------------

  describe('feed', () => {
    it('returns [] when the caller is not checked in anywhere', async () => {
      redis.get.mockResolvedValue(null);
      const result = await service.feed('caller1');
      expect(result).toEqual([]);
    });

    it('returns [] when the store has no pods', async () => {
      redis.get.mockResolvedValue('store1');
      redis.smembers.mockResolvedValue([]);
      const result = await service.feed('caller1');
      expect(result).toEqual([]);
    });

    it('prunes expired pod ids from the store set', async () => {
      redis.get.mockResolvedValue('store1');
      redis.smembers.mockResolvedValue(['expired-pod', 'pod1']);
      // getPod('expired-pod') -> null, getPod('pod1') -> valid
      redis.get.mockImplementation((key: string) => {
        if (key === 'presence:caller1') return Promise.resolve('store1');
        if (key === 'pod:expired-pod') return Promise.resolve(null);
        if (key === 'pod:pod1') return Promise.resolve(JSON.stringify(makePod()));
        return Promise.resolve(null);
      });
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue(null);

      await service.feed('caller1');

      expect(redis.srem).toHaveBeenCalledWith('pod_store:store1', 'expired-pod');
    });

    it('excludes pods hosted by a blocked user', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'presence:caller1') return Promise.resolve('store1');
        if (key === 'pod:pod1') return Promise.resolve(JSON.stringify(makePod({ hostId: 'blockedHost' })));
        return Promise.resolve(null);
      });
      redis.smembers.mockResolvedValue(['pod1']);
      safety.getBlockedIds.mockResolvedValue(new Set(['blockedHost']));

      const result = await service.feed('caller1');
      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('excludes hosts who opted out of discoverability', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'presence:caller1') return Promise.resolve('store1');
        if (key === 'pod:pod1') return Promise.resolve(JSON.stringify(makePod()));
        return Promise.resolve(null);
      });
      redis.smembers.mockResolvedValue(['pod1']);
      prisma.user.findMany.mockResolvedValue([
        { ...makeProfile('host1'), privacySettings: { discoverable: false } },
      ]);
      prisma.user.findUnique.mockResolvedValue({ powerLevel: 7, formats: ['commander'] });

      const result = await service.feed('caller1');
      expect(result).toEqual([]);
    });

    it('maps open pods with fit and seatsOpen', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'presence:caller1') return Promise.resolve('store1');
        if (key === 'pod:pod1') return Promise.resolve(JSON.stringify(makePod({ seats: 4, memberIds: ['host1'] })));
        return Promise.resolve(null);
      });
      redis.smembers.mockResolvedValue(['pod1']);
      prisma.user.findMany.mockResolvedValue([
        { ...makeProfile('host1'), privacySettings: { discoverable: true } },
      ]);
      prisma.user.findUnique.mockResolvedValue({ powerLevel: 7, formats: ['commander'] });

      const result = await service.feed('caller1');
      expect(result).toEqual([
        expect.objectContaining({
          id: 'pod1',
          hostId: 'host1',
          seatsOpen: 3,
          fit: { tier: 'great', label: expect.any(String) },
        }),
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // detail()
  // ---------------------------------------------------------------------------

  describe('detail', () => {
    it('throws NotFoundException when the pod does not exist', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.detail('caller1', 'pod1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the host profile is missing', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod()));
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([]); // host missing from results

      await expect(service.detail('member1', 'pod1')).rejects.toThrow(NotFoundException);
    });

    it('returns member view without candidates for a non-host caller', async () => {
      const pod = makePod({ memberIds: ['host1', 'member1'], requestIds: ['requester1'] });
      redis.get.mockResolvedValue(JSON.stringify(pod));
      prisma.user.findUnique.mockResolvedValue({ powerLevel: 7, formats: ['commander'] });
      prisma.user.findMany.mockResolvedValue([makeProfile('host1'), makeProfile('member1')]);

      const result = await service.detail('member1', 'pod1');

      expect(result.candidates).toEqual([]);
      expect(result.requests).toEqual([]); // not host, so requestUsers query is skipped
      expect(result.hasRequested).toBe(false);
      expect(result.members.map((m) => m.id)).toEqual(['host1', 'member1']);
    });

    it('includes candidates for the host', async () => {
      const pod = makePod({ memberIds: ['host1'], requestIds: [] });
      redis.get.mockImplementation((key: string) => {
        if (key === 'pod:pod1') return Promise.resolve(JSON.stringify(pod));
        return Promise.resolve(0 as unknown as string | null);
      });
      prisma.user.findUnique.mockResolvedValue({ powerLevel: 7, formats: ['commander'] });
      prisma.user.findMany
        .mockResolvedValueOnce([makeProfile('host1')]) // allUsers
        .mockResolvedValueOnce([{ ...makeProfile('candidate1'), privacySettings: { discoverable: true } }]); // getCandidates
      redis.zrange.mockResolvedValue(['candidate1']);
      redis.exists.mockResolvedValue(1);

      const result = await service.detail('host1', 'pod1');

      expect(result.candidates).toEqual([
        expect.objectContaining({ id: 'candidate1', fit: { tier: 'great', label: expect.any(String) } }),
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // request()
  // ---------------------------------------------------------------------------

  describe('request', () => {
    it('throws NotFoundException when the pod does not exist', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.request('u1', 'pod1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the caller is already a member', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod({ memberIds: ['host1', 'u1'] })));
      await expect(service.request('u1', 'pod1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when the caller already requested', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod({ requestIds: ['u1'] })));
      await expect(service.request('u1', 'pod1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when the pod is full', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify(makePod({ seats: 1, memberIds: ['host1'] })),
      );
      await expect(service.request('u1', 'pod1')).rejects.toThrow(ConflictException);
    });

    it('adds the caller to requestIds and notifies the host', async () => {
      const pod = makePod({ seats: 4, memberIds: ['host1'] });
      redis.get.mockResolvedValue(JSON.stringify(pod));
      prisma.user.findUnique.mockResolvedValue({ displayName: 'Requester' });

      const result = await service.request('u1', 'pod1');

      expect(redis.setex).toHaveBeenCalledWith(
        'pod:pod1',
        expect.any(Number),
        expect.stringContaining('"requestIds":["u1"]'),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        'host1',
        expect.objectContaining({ kind: 'POD', data: { type: 'pod_join_request', podId: 'pod1', userId: 'u1' } }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ---------------------------------------------------------------------------
  // approve()
  // ---------------------------------------------------------------------------

  describe('approve', () => {
    const dto = { userId: 'requester1' };

    it('throws NotFoundException when the pod does not exist', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.approve('host1', 'pod1', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the host', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod({ requestIds: ['requester1'] })));
      await expect(service.approve('notHost', 'pod1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the user did not request to join', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod({ requestIds: [] })));
      await expect(service.approve('host1', 'pod1', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the pod is already full', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify(makePod({ seats: 1, memberIds: ['host1'], requestIds: ['requester1'] })),
      );
      await expect(service.approve('host1', 'pod1', dto)).rejects.toThrow(ConflictException);
    });

    it('moves the user from requestIds to memberIds and notifies them', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify(makePod({ seats: 4, memberIds: ['host1'], requestIds: ['requester1'] })),
      );

      const result = await service.approve('host1', 'pod1', dto);

      expect(redis.setex).toHaveBeenCalledWith(
        'pod:pod1',
        expect.any(Number),
        expect.stringContaining('"memberIds":["host1","requester1"]'),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        'requester1',
        expect.objectContaining({ kind: 'POD', data: { type: 'pod_approved', podId: 'pod1' } }),
      );
      expect(result).toEqual({ success: true, seatsOpen: 2 });
    });
  });

  // ---------------------------------------------------------------------------
  // decline()
  // ---------------------------------------------------------------------------

  describe('decline', () => {
    const dto = { userId: 'requester1' };

    it('throws NotFoundException when the pod does not exist', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.decline('host1', 'pod1', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the host', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod({ requestIds: ['requester1'] })));
      await expect(service.decline('notHost', 'pod1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('removes the user from requestIds', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod({ requestIds: ['requester1'] })));
      const result = await service.decline('host1', 'pod1', dto);
      expect(redis.setex).toHaveBeenCalledWith(
        'pod:pod1',
        expect.any(Number),
        expect.stringContaining('"requestIds":[]'),
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ---------------------------------------------------------------------------
  // disband()
  // ---------------------------------------------------------------------------

  describe('disband', () => {
    it('does nothing when the pod does not exist', async () => {
      redis.get.mockResolvedValue(null);
      await service.disband('host1', 'pod1');
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller is not the host', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod()));
      await expect(service.disband('notHost', 'pod1')).rejects.toThrow(ForbiddenException);
    });

    it('disbands the pod when called by the host', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod()));
      await service.disband('host1', 'pod1');
      expect(redis.del).toHaveBeenCalledWith('pod:pod1');
      expect(redis.srem).toHaveBeenCalledWith('pod_store:store1', 'pod1');
      expect(redis.del).toHaveBeenCalledWith('user_pod:host1');
    });
  });

  // ---------------------------------------------------------------------------
  // lock()
  // ---------------------------------------------------------------------------

  describe('lock', () => {
    it('throws NotFoundException when the pod does not exist', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.lock('host1', 'pod1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the host', async () => {
      redis.get.mockResolvedValue(JSON.stringify(makePod()));
      await expect(service.lock('notHost', 'pod1')).rejects.toThrow(ForbiddenException);
    });

    it('creates a draw encounter pair for every ordered pair of members and disbands the pod', async () => {
      const pod = makePod({ memberIds: ['host1', 'member1', 'member2'] });
      redis.get.mockResolvedValue(JSON.stringify(pod));
      prisma.encounter.createMany.mockResolvedValue({ count: 6 });

      const result = await service.lock('host1', 'pod1');

      expect(prisma.encounter.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          { userId: 'host1', opponentId: 'member1', storeId: 'store1', source: 'GAME', result: 'DRAW', notes: 'Pod locked' },
          { userId: 'member1', opponentId: 'host1', storeId: 'store1', source: 'GAME', result: 'DRAW', notes: 'Pod locked' },
        ]),
        skipDuplicates: true,
      });
      const data = prisma.encounter.createMany.mock.calls[0][0].data as unknown[];
      expect(data).toHaveLength(6); // 3 members -> 3 unordered pairs * 2 directions
      expect(redis.del).toHaveBeenCalledWith('pod:pod1');
      expect(result).toEqual({ success: true });
    });

    it('skips encounter creation for a solo pod (no pairs)', async () => {
      const pod = makePod({ memberIds: ['host1'] });
      redis.get.mockResolvedValue(JSON.stringify(pod));

      await service.lock('host1', 'pod1');

      expect(prisma.encounter.createMany).not.toHaveBeenCalled();
    });
  });
});
