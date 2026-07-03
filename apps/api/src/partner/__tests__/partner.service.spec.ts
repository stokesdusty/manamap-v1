import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PartnerService } from '../partner.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventRemindersService } from '../../event-reminders/event-reminders.service';

function makePrismaMock() {
  return {
    $transaction: jest.fn(),
    store: { findUnique: jest.fn(), update: jest.fn() },
    storeOwnership: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    storeClaim: { create: jest.fn(), findFirst: jest.fn() },
    user: { update: jest.fn(), findUnique: jest.fn() },
    checkin: { count: jest.fn(), groupBy: jest.fn() },
    rewardOffer: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    format: { findMany: jest.fn() },
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    eventAttendee: { findMany: jest.fn() },
  };
}

describe('PartnerService', () => {
  let service: PartnerService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let eventReminders: { scheduleReminders: jest.Mock; cancelReminders: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    eventReminders = {
      scheduleReminders: jest.fn().mockResolvedValue(undefined),
      cancelReminders: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        PartnerService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventRemindersService, useValue: eventReminders },
      ],
    }).compile();

    service = module.get(PartnerService);
  });

  // ---------------------------------------------------------------------------
  // assertOwner (exercised indirectly through every guarded method)
  // ---------------------------------------------------------------------------

  describe('ownership guard', () => {
    it('throws ForbiddenException when the caller neither owns the store nor is an admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
      prisma.storeOwnership.findUnique.mockResolvedValue(null);

      await expect(service.getAnalytics('u1', 'store1')).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMINs through without an ownership row', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      prisma.checkin.count.mockResolvedValue(0);
      prisma.checkin.groupBy.mockResolvedValue([]);
      prisma.rewardOffer.count.mockResolvedValue(0);

      await expect(service.getAnalytics('admin1', 'store1')).resolves.toBeDefined();
      expect(prisma.storeOwnership.findUnique).not.toHaveBeenCalled();
    });

    it('allows an owner through', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
      prisma.storeOwnership.findUnique.mockResolvedValue({ id: 'ownership1' });
      prisma.checkin.count.mockResolvedValue(0);
      prisma.checkin.groupBy.mockResolvedValue([]);
      prisma.rewardOffer.count.mockResolvedValue(0);

      await expect(service.getAnalytics('owner1', 'store1')).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // claimStore()
  // ---------------------------------------------------------------------------

  describe('claimStore', () => {
    it('throws NotFoundException when the store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValue(null);
      await expect(service.claimStore('u1', 'store1', {})).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException and logs a rejected claim when the store already has an owner', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', name: 'Store 1', claimCode: null });
      prisma.storeOwnership.findFirst.mockResolvedValue({ id: 'existing-ownership' });
      prisma.storeClaim.create.mockResolvedValue({});

      await expect(service.claimStore('u1', 'store1', {})).rejects.toThrow(ConflictException);
      expect(prisma.storeClaim.create).toHaveBeenCalledWith({
        data: { storeId: 'store1', userId: 'u1', status: 'REJECTED', rejectionReason: 'already_claimed' },
      });
    });

    it('throws BadRequestException and logs a rejected claim for a bad code', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', name: 'Store 1', claimCode: 'ABC123' });
      prisma.storeOwnership.findFirst.mockResolvedValue(null);
      prisma.storeClaim.create.mockResolvedValue({});

      await expect(service.claimStore('u1', 'store1', { code: 'WRONG' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.storeClaim.create).toHaveBeenCalledWith({
        data: { storeId: 'store1', userId: 'u1', status: 'REJECTED', rejectionReason: 'invalid_code' },
      });
    });

    it('approves the claim via transaction when the code matches (case-insensitive)', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', name: 'Store 1', claimCode: 'ABC123' });
      prisma.storeOwnership.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockResolvedValue([{}, {}, {}, {}]);

      const result = await service.claimStore('u1', 'store1', { code: 'abc123' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(4);
      expect(result).toEqual({ status: 'APPROVED', storeId: 'store1', storeName: 'Store 1' });
    });

    it('throws ConflictException when a pending claim already exists (no code path)', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', name: 'Store 1', claimCode: null });
      prisma.storeOwnership.findFirst.mockResolvedValue(null);
      prisma.storeClaim.findFirst.mockResolvedValue({ id: 'pending1' });

      await expect(service.claimStore('u1', 'store1', {})).rejects.toThrow(ConflictException);
    });

    it('creates a PENDING claim when no code is supplied and none is pending', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', name: 'Store 1', claimCode: null });
      prisma.storeOwnership.findFirst.mockResolvedValue(null);
      prisma.storeClaim.findFirst.mockResolvedValue(null);
      prisma.storeClaim.create.mockResolvedValue({});

      const result = await service.claimStore('u1', 'store1', { note: 'please approve' });

      expect(prisma.storeClaim.create).toHaveBeenCalledWith({
        data: { storeId: 'store1', userId: 'u1', status: 'PENDING', note: 'please approve' },
      });
      expect(result).toEqual({ status: 'PENDING', storeId: 'store1', storeName: 'Store 1' });
    });
  });

  // ---------------------------------------------------------------------------
  // getMyStores()
  // ---------------------------------------------------------------------------

  describe('getMyStores', () => {
    it('maps ownerships to stores with claimedAt', async () => {
      const claimedAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.storeOwnership.findMany.mockResolvedValue([
        { storeId: 'store1', createdAt: claimedAt, store: { id: 'store1', name: 'Store 1', city: 'Seattle', state: 'WA' } },
      ]);

      const result = await service.getMyStores('u1');
      expect(result).toEqual([
        { id: 'store1', name: 'Store 1', city: 'Seattle', state: 'WA', claimedAt: claimedAt.toISOString() },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // Offer CRUD
  // ---------------------------------------------------------------------------

  describe('createOffer', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    });

    it('retries code generation until a unique code is found', async () => {
      prisma.rewardOffer.findUnique
        .mockResolvedValueOnce({ id: 'collision' })
        .mockResolvedValueOnce(null);
      prisma.rewardOffer.create.mockResolvedValue({ id: 'offer1' });

      await service.createOffer('u1', 'store1', { type: 'FIRST_VISIT', title: 'Welcome' } as any);

      expect(prisma.rewardOffer.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.rewardOffer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ storeId: 'store1', type: 'FIRST_VISIT', title: 'Welcome' }),
        }),
      );
    });
  });

  describe('updateOffer', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    });

    it('throws NotFoundException when the offer does not belong to the store', async () => {
      prisma.rewardOffer.findFirst.mockResolvedValue(null);
      await expect(
        service.updateOffer('u1', 'store1', 'offer1', { title: 'New title' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('only patches provided fields', async () => {
      prisma.rewardOffer.findFirst.mockResolvedValue({ id: 'offer1' });
      prisma.rewardOffer.update.mockResolvedValue({});

      await service.updateOffer('u1', 'store1', 'offer1', { active: false } as any);

      expect(prisma.rewardOffer.update).toHaveBeenCalledWith({
        where: { id: 'offer1' },
        data: { active: false },
      });
    });
  });

  describe('deleteOffer', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    });

    it('throws NotFoundException when the offer does not belong to the store', async () => {
      prisma.rewardOffer.findFirst.mockResolvedValue(null);
      await expect(service.deleteOffer('u1', 'store1', 'offer1')).rejects.toThrow(NotFoundException);
      expect(prisma.rewardOffer.delete).not.toHaveBeenCalled();
    });

    it('deletes the offer when it belongs to the store', async () => {
      prisma.rewardOffer.findFirst.mockResolvedValue({ id: 'offer1' });
      prisma.rewardOffer.delete.mockResolvedValue({});

      await service.deleteOffer('u1', 'store1', 'offer1');
      expect(prisma.rewardOffer.delete).toHaveBeenCalledWith({ where: { id: 'offer1' } });
    });
  });

  // ---------------------------------------------------------------------------
  // Event CRUD
  // ---------------------------------------------------------------------------

  describe('createPartnerEvent', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    });

    it('creates a single event when repeatWeekly is not set', async () => {
      prisma.event.create.mockResolvedValue({
        id: 'evt1',
        name: 'Draft Night',
        source: 'STORE',
        description: null,
        formatId: null,
        startsAt: new Date('2026-05-01T18:00:00.000Z'),
        endsAt: null,
        eventChannelUrl: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        format: null,
      });

      const result = await service.createPartnerEvent('u1', 'store1', {
        name: 'Draft Night',
        startsAt: '2026-05-01T18:00:00.000Z',
      } as any);

      expect(prisma.event.createMany).not.toHaveBeenCalled();
      expect(result.attendeeCount).toBe(0);
      expect(result.id).toBe('evt1');
    });

    it('creates EVENT_RECURRENCE_WEEKS - 1 additional weekly copies when repeatWeekly is set', async () => {
      prisma.event.create.mockResolvedValue({
        id: 'evt1',
        name: 'Draft Night',
        source: 'STORE',
        description: null,
        formatId: null,
        startsAt: new Date('2026-05-01T18:00:00.000Z'),
        endsAt: null,
        eventChannelUrl: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        format: null,
      });
      prisma.event.createMany.mockResolvedValue({ count: 11 });

      await service.createPartnerEvent('u1', 'store1', {
        name: 'Draft Night',
        startsAt: '2026-05-01T18:00:00.000Z',
        repeatWeekly: true,
      } as any);

      expect(prisma.event.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ storeId: 'store1' })]) }),
      );
      const data = prisma.event.createMany.mock.calls[0][0].data as unknown[];
      expect(data).toHaveLength(11);
    });
  });

  describe('updatePartnerEvent', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    });

    it('throws NotFoundException when the event is not found at the store', async () => {
      prisma.event.findFirst.mockResolvedValue(null);
      await expect(
        service.updatePartnerEvent('u1', 'store1', 'evt1', { name: 'New name' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for non-STORE-sourced events', async () => {
      prisma.event.findFirst.mockResolvedValue({
        id: 'evt1',
        source: 'EXTERNAL',
        name: 'Old',
        startsAt: new Date(),
        store: { id: 'store1', name: 'Store 1', timezone: null },
      });
      await expect(
        service.updatePartnerEvent('u1', 'store1', 'evt1', { name: 'New name' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reschedules reminders for existing attendees when startsAt changes', async () => {
      const oldStartsAt = new Date('2026-05-01T18:00:00.000Z');
      const newStartsAt = new Date('2026-05-02T18:00:00.000Z');
      prisma.event.findFirst.mockResolvedValue({
        id: 'evt1',
        source: 'STORE',
        name: 'Draft Night',
        startsAt: oldStartsAt,
        store: { id: 'store1', name: 'Store 1', timezone: 'America/Los_Angeles' },
      });
      prisma.event.update.mockResolvedValue({
        id: 'evt1',
        name: 'Draft Night',
        source: 'STORE',
        description: null,
        formatId: null,
        startsAt: newStartsAt,
        endsAt: null,
        eventChannelUrl: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        format: null,
        _count: { attendees: 2 },
      });
      prisma.eventAttendee.findMany.mockResolvedValue([{ userId: 'attendee1' }, { userId: 'attendee2' }]);

      await service.updatePartnerEvent('u1', 'store1', 'evt1', {
        startsAt: newStartsAt.toISOString(),
      } as any);

      expect(eventReminders.cancelReminders).toHaveBeenCalledWith('attendee1', 'evt1');
      expect(eventReminders.cancelReminders).toHaveBeenCalledWith('attendee2', 'evt1');
      expect(eventReminders.scheduleReminders).toHaveBeenCalledWith(
        'attendee1',
        expect.objectContaining({ eventId: 'evt1', startsAt: newStartsAt }),
      );
    });

    it('does not touch reminders when startsAt is unchanged', async () => {
      const startsAt = new Date('2026-05-01T18:00:00.000Z');
      prisma.event.findFirst.mockResolvedValue({
        id: 'evt1',
        source: 'STORE',
        name: 'Draft Night',
        startsAt,
        store: { id: 'store1', name: 'Store 1', timezone: null },
      });
      prisma.event.update.mockResolvedValue({
        id: 'evt1',
        name: 'New name',
        source: 'STORE',
        description: null,
        formatId: null,
        startsAt,
        endsAt: null,
        eventChannelUrl: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        format: null,
        _count: { attendees: 0 },
      });

      await service.updatePartnerEvent('u1', 'store1', 'evt1', { name: 'New name' } as any);

      expect(prisma.eventAttendee.findMany).not.toHaveBeenCalled();
      expect(eventReminders.scheduleReminders).not.toHaveBeenCalled();
    });
  });

  describe('deletePartnerEvent', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    });

    it('throws NotFoundException when the event is not found at the store', async () => {
      prisma.event.findFirst.mockResolvedValue(null);
      await expect(service.deletePartnerEvent('u1', 'store1', 'evt1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for non-STORE-sourced events', async () => {
      prisma.event.findFirst.mockResolvedValue({ id: 'evt1', source: 'EXTERNAL' });
      await expect(service.deletePartnerEvent('u1', 'store1', 'evt1')).rejects.toThrow(ForbiddenException);
    });

    it('deletes STORE-sourced events', async () => {
      prisma.event.findFirst.mockResolvedValue({ id: 'evt1', source: 'STORE' });
      prisma.event.delete.mockResolvedValue({});

      await service.deletePartnerEvent('u1', 'store1', 'evt1');
      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 'evt1' } });
    });
  });
});
