import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PresenceService } from '../presence.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { REDIS } from '../../redis/redis.module';

function makePrismaMock() {
  return {
    store: { findUnique: jest.fn() },
    user: { update: jest.fn() },
  };
}

function makeNotificationsMock() {
  return {
    create: jest.fn().mockResolvedValue(undefined),
  };
}

function makeRedisMock() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    zadd: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(1),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    getdel: jest.fn().mockResolvedValue(null),
  };
}

describe('PresenceService', () => {
  let service: PresenceService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let redis: ReturnType<typeof makeRedisMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();
    redis = makeRedisMock();

    const module = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: REDIS, useValue: redis },
      ],
    }).compile();

    service = module.get(PresenceService);
  });

  // -------------------------------------------------------------------------
  // heartbeat
  // -------------------------------------------------------------------------

  describe('heartbeat', () => {
    it('throws NotFoundException when storeId is provided but store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValue(null);
      await expect(service.heartbeat('u1', { storeId: 'store1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sets presence key and adds to store sorted set when store exists', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', name: 'Test Store' });
      redis.get.mockResolvedValue(null);

      const result = await service.heartbeat('u1', { storeId: 'store1' });

      expect(redis.setex).toHaveBeenCalledWith('presence:u1', 300, 'store1');
      expect(redis.zadd).toHaveBeenCalledWith('store_members:store1', expect.any(Number), 'u1');
      expect(result.storeId).toBe('store1');
      expect(result.storeName).toBe('Test Store');
      expect(result.expiresIn).toBe(300);
    });

    it('removes user from old store sorted set when switching stores', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store2', name: 'New Store' });
      redis.get.mockResolvedValue('store1'); // user was at store1

      await service.heartbeat('u1', { storeId: 'store2' });

      expect(redis.zrem).toHaveBeenCalledWith('store_members:store1', 'u1');
    });

    it('does not call zrem when user is at the same store', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', name: 'Store' });
      redis.get.mockResolvedValue('store1'); // same store

      await service.heartbeat('u1', { storeId: 'store1' });

      expect(redis.zrem).not.toHaveBeenCalled();
    });

    it('returns null storeId and storeName when storeId is not provided', async () => {
      const result = await service.heartbeat('u1', {});

      expect(result.storeId).toBeNull();
      expect(result.storeName).toBeNull();
      expect(prisma.store.findUnique).not.toHaveBeenCalled();
    });

    it('updates user location when lat and lng are provided', async () => {
      prisma.user.update.mockResolvedValue({});

      await service.heartbeat('u1', { lat: 37.5, lng: -122.1 });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({
            lastLat: 37.5,
            lastLng: -122.1,
            lastLocatedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('does not update location when lat and lng are absent', async () => {
      await service.heartbeat('u1', {});
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // checkout
  // -------------------------------------------------------------------------

  describe('checkout', () => {
    it('removes user from store sorted set and deletes presence key', async () => {
      redis.get.mockResolvedValue('store1');

      await service.checkout('u1');

      expect(redis.zrem).toHaveBeenCalledWith('store_members:store1', 'u1');
      expect(redis.del).toHaveBeenCalledWith('presence:u1');
    });

    it('still deletes presence key when user has no active store', async () => {
      redis.get.mockResolvedValue(null);

      await service.checkout('u1');

      expect(redis.zrem).not.toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('presence:u1');
    });
  });

  // -------------------------------------------------------------------------
  // getStoreMembers
  // -------------------------------------------------------------------------

  describe('getStoreMembers', () => {
    it('returns empty array when store has no members in sorted set', async () => {
      redis.zrange.mockResolvedValue([]);
      const result = await service.getStoreMembers('store1');
      expect(result).toEqual([]);
    });

    it('returns only members whose presence key still exists', async () => {
      redis.zrange.mockResolvedValue(['u1', 'u2', 'u3']);
      redis.exists
        .mockResolvedValueOnce(1) // u1 active
        .mockResolvedValueOnce(0) // u2 expired
        .mockResolvedValueOnce(1); // u3 active

      const result = await service.getStoreMembers('store1');

      expect(result).toEqual(['u1', 'u3']);
    });

    it('prunes expired members from the sorted set', async () => {
      redis.zrange.mockResolvedValue(['u1', 'u2']);
      redis.exists
        .mockResolvedValueOnce(1) // u1 active
        .mockResolvedValueOnce(0); // u2 expired

      await service.getStoreMembers('store1');

      expect(redis.zrem).toHaveBeenCalledWith('store_members:store1', 'u2');
    });

    it('does not call zrem when all members are active', async () => {
      redis.zrange.mockResolvedValue(['u1', 'u2']);
      redis.exists.mockResolvedValue(1);

      await service.getStoreMembers('store1');

      expect(redis.zrem).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // subscribeNotifyWhenActive
  // -------------------------------------------------------------------------

  describe('subscribeNotifyWhenActive', () => {
    it('throws NotFoundException when store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValue(null);
      await expect(service.subscribeNotifyWhenActive('sub1', 'store1', 2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('stores the threshold with a TTL and indexes the subscriber', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1' });

      await service.subscribeNotifyWhenActive('sub1', 'store1', 2);

      expect(redis.set).toHaveBeenCalledWith('notify_active:store1:sub1', 2, 'EX', 6 * 60 * 60);
      expect(redis.sadd).toHaveBeenCalledWith('notify_active_subs:store1', 'sub1');
    });
  });

  // -------------------------------------------------------------------------
  // checkAndNotifyThreshold (exercised via heartbeat)
  // -------------------------------------------------------------------------

  describe('threshold notification on heartbeat', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    beforeEach(() => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', name: "Dragon's Den" });
      redis.zrange.mockResolvedValue(['u1', 'u2', 'u3']);
      redis.exists.mockResolvedValue(1);
    });

    it('fires a push and clears the subscription once the threshold is crossed', async () => {
      redis.smembers.mockResolvedValue(['sub1']);
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key === 'notify_active:store1:sub1' ? '2' : null),
      );
      redis.getdel.mockResolvedValue('2');

      await service.heartbeat('u1', { storeId: 'store1' });
      await flush();

      expect(notifications.create).toHaveBeenCalledWith(
        'sub1',
        expect.objectContaining({
          body: "3 players just checked in at Dragon's Den",
        }),
      );
      expect(redis.srem).toHaveBeenCalledWith('notify_active_subs:store1', 'sub1');
    });

    it('does not fire when the active count is still below the threshold', async () => {
      redis.zrange.mockResolvedValue(['u1']);
      redis.smembers.mockResolvedValue(['sub1']);
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key === 'notify_active:store1:sub1' ? '5' : null),
      );

      await service.heartbeat('u1', { storeId: 'store1' });
      await flush();

      expect(redis.getdel).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('drops a subscriber whose threshold key already expired', async () => {
      redis.smembers.mockResolvedValue(['sub1']);
      redis.get.mockResolvedValue(null);

      await service.heartbeat('u1', { storeId: 'store1' });
      await flush();

      expect(redis.srem).toHaveBeenCalledWith('notify_active_subs:store1', 'sub1');
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('does not notify twice when a concurrent heartbeat already claimed the subscription', async () => {
      redis.smembers.mockResolvedValue(['sub1']);
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key === 'notify_active:store1:sub1' ? '2' : null),
      );
      redis.getdel.mockResolvedValue(null); // another heartbeat already claimed it

      await service.heartbeat('u1', { storeId: 'store1' });
      await flush();

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
