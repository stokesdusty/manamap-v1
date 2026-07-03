import { Test } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { StoresService } from '../stores.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from '../../presence/presence.service';
import { GamificationService } from '../../gamification/gamification.service';
import { EventRemindersService } from '../../event-reminders/event-reminders.service';
import { SafetyService } from '../../safety/safety.service';
import { QuestsService } from '../../quests/quests.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AnalyticsService } from '../../analytics/analytics.service';

function makePrismaMock() {
  return {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    store: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    checkin: {
      updateMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    eventAttendee: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    rewardOffer: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    storeConfirmation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };
}

function makeLoggerMock() {
  return { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
}

describe('StoresService', () => {
  let service: StoresService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let presence: { heartbeat: jest.Mock; getStoreMembers: jest.Mock; subscribeNotifyWhenActive: jest.Mock };
  let gamification: { processCheckin: jest.Mock; getLeaderboard: jest.Mock; getWinsLeaderboard: jest.Mock };
  let eventReminders: { scheduleReminders: jest.Mock; cancelReminders: jest.Mock };
  let safety: { getBlockedIds: jest.Mock };
  let quests: { evaluate: jest.Mock };
  let notifications: { create: jest.Mock };
  let analytics: { capture: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    presence = {
      heartbeat: jest.fn().mockResolvedValue({ expiresIn: 30 }),
      getStoreMembers: jest.fn().mockResolvedValue([]),
      subscribeNotifyWhenActive: jest.fn().mockResolvedValue(undefined),
    };
    gamification = {
      processCheckin: jest.fn().mockResolvedValue({ newBadges: [], streak: null }),
      getLeaderboard: jest.fn().mockResolvedValue({ entries: [] }),
      getWinsLeaderboard: jest.fn().mockResolvedValue([]),
    };
    eventReminders = {
      scheduleReminders: jest.fn().mockResolvedValue(undefined),
      cancelReminders: jest.fn().mockResolvedValue(undefined),
    };
    safety = { getBlockedIds: jest.fn().mockResolvedValue(new Set()) };
    quests = { evaluate: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    analytics = { capture: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        StoresService,
        { provide: getLoggerToken(StoresService.name), useValue: makeLoggerMock() },
        { provide: PrismaService, useValue: prisma },
        { provide: PresenceService, useValue: presence },
        { provide: GamificationService, useValue: gamification },
        { provide: EventRemindersService, useValue: eventReminders },
        { provide: SafetyService, useValue: safety },
        { provide: QuestsService, useValue: quests },
        { provide: NotificationsService, useValue: notifications },
        { provide: AnalyticsService, useValue: analytics },
      ],
    }).compile();

    service = module.get(StoresService);
  });

  // ---------------------------------------------------------------------------
  // list()
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('returns [] for a malformed bbox', async () => {
      const result = await service.list({ bbox: 'not,valid', q: undefined });
      expect(result).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('maps PostGIS rows to pins when bbox is given', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { id: 's1', name: 'Store 1', status: 'ACTIVE', lat: 40.1, lng: -73.2, confirmation_count: 3 },
        { id: 's2', name: 'Store 2', status: 'PROPOSED', lat: null, lng: null, confirmation_count: 0 },
      ]);

      const result = await service.list({ bbox: '-74,40,-73,41', q: undefined });

      expect(result).toEqual([
        { id: 's1', name: 'Store 1', lat: 40.1, lng: -73.2, proposed: false, confirmationCount: 3 },
        { id: 's2', name: 'Store 2', lat: null, lng: null, proposed: true, confirmationCount: 0 },
      ]);
    });

    it('falls back to text search when no bbox is given', async () => {
      prisma.store.findMany.mockResolvedValueOnce([
        { id: 's1', name: 'Card Kingdom', city: 'Seattle', state: 'WA', status: 'ACTIVE' },
      ]);

      const result = await service.list({ bbox: undefined, q: 'card' });

      expect(prisma.store.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            OR: expect.arrayContaining([{ name: { contains: 'card', mode: 'insensitive' } }]),
          }),
        }),
      );
      expect(result).toEqual([
        { id: 's1', name: 'Card Kingdom', city: 'Seattle', state: 'WA', proposed: false },
      ]);
    });

    it('includes non-rejected stores when includeProposed is true', async () => {
      prisma.store.findMany.mockResolvedValueOnce([]);
      await service.list({ bbox: undefined, q: undefined, includeProposed: true });
      expect(prisma.store.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: { not: 'REJECTED' } } }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getDetail()
  // ---------------------------------------------------------------------------

  describe('getDetail', () => {
    it('throws NotFoundException when no rows come back', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.getDetail('missing')).rejects.toThrow(NotFoundException);
    });

    it('maps the detail row, coercing lat/lng to numbers', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 's1',
          name: 'Store 1',
          address: '123 Main St',
          city: 'Seattle',
          state: 'WA',
          zip: '98101',
          discordUrl: null,
          lat: '40.1',
          lng: '-73.2',
        },
      ]);

      const result = await service.getDetail('s1');
      expect(result).toEqual({
        id: 's1',
        name: 'Store 1',
        address: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
        discordUrl: null,
        lat: 40.1,
        lng: -73.2,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // checkin()
  // ---------------------------------------------------------------------------

  describe('checkin', () => {
    const body = { lat: 40.1, lng: -73.2, accuracy: 10 };

    function mockActiveStore(overrides: Partial<Record<string, unknown>> = {}) {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 'store1',
          name: 'Store 1',
          status: 'ACTIVE',
          has_geom: true,
          within: true,
          distance_m: 50,
          allowed_m: 1150,
          ...overrides,
        },
      ]);
    }

    it('throws NotFoundException when the store does not exist', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.checkin('u1', 'store1', body)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the store is not ACTIVE', async () => {
      mockActiveStore({ status: 'PROPOSED' });
      await expect(service.checkin('u1', 'store1', body)).rejects.toThrow(NotFoundException);
    });

    it('throws a too_far HttpException when outside the allowed radius', async () => {
      mockActiveStore({ within: false, distance_m: 2000, allowed_m: 1150 });

      await expect(service.checkin('u1', 'store1', body)).rejects.toThrow(HttpException);
      mockActiveStore({ within: false, distance_m: 2000, allowed_m: 1150 });
      try {
        await service.checkin('u1', 'store1', body);
      } catch (err) {
        expect((err as HttpException).getResponse()).toEqual({
          code: 'too_far',
          distanceMeters: 2000,
          allowedMeters: 1150,
        });
      }
    });

    it('skips the proximity check (with a warning) when the store has no geom', async () => {
      mockActiveStore({ has_geom: false, within: null, distance_m: null });
      prisma.checkin.updateMany.mockResolvedValue({ count: 0 });
      prisma.checkin.create.mockResolvedValue({ id: 'checkin1', checkedInAt: new Date('2026-01-01') });
      prisma.checkin.count.mockResolvedValue(0);
      prisma.rewardOffer.findMany.mockResolvedValue([]);
      prisma.event.findMany.mockResolvedValue([]);

      const result = await service.checkin('u1', 'store1', body);
      expect(result.checkinId).toBe('checkin1');
    });

    it('checks the user out of any other open checkin and creates the new one', async () => {
      mockActiveStore();
      prisma.checkin.updateMany.mockResolvedValue({ count: 1 });
      prisma.checkin.create.mockResolvedValue({ id: 'checkin1', checkedInAt: new Date('2026-01-01') });
      prisma.checkin.count.mockResolvedValue(0);
      prisma.rewardOffer.findMany.mockResolvedValue([]);
      prisma.event.findMany.mockResolvedValue([]);

      await service.checkin('u1', 'store1', body);

      expect(prisma.checkin.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', checkedOutAt: null, storeId: { not: 'store1' } },
        data: { checkedOutAt: expect.any(Date) },
      });
      expect(prisma.checkin.create).toHaveBeenCalledWith({ data: { userId: 'u1', storeId: 'store1' } });
    });

    it('fires quest evaluation without awaiting it', async () => {
      mockActiveStore();
      prisma.checkin.updateMany.mockResolvedValue({ count: 0 });
      prisma.checkin.create.mockResolvedValue({ id: 'checkin1', checkedInAt: new Date('2026-01-01') });
      prisma.checkin.count.mockResolvedValue(0);
      prisma.rewardOffer.findMany.mockResolvedValue([]);
      prisma.event.findMany.mockResolvedValue([]);

      await service.checkin('u1', 'store1', body);
      expect(quests.evaluate).toHaveBeenCalledWith('u1');
    });

    it('includes a FIRST_VISIT offer only when the user has no prior visits', async () => {
      mockActiveStore();
      prisma.checkin.updateMany.mockResolvedValue({ count: 0 });
      prisma.checkin.create.mockResolvedValue({ id: 'checkin1', checkedInAt: new Date('2026-01-01') });
      prisma.checkin.count.mockResolvedValue(1); // has prior visits
      prisma.rewardOffer.findMany.mockResolvedValue([
        {
          id: 'offer1',
          type: 'FIRST_VISIT',
          title: 'Welcome',
          description: null,
          terms: null,
          redemptionCode: 'CODE1',
          streakRequired: null,
        },
      ]);
      prisma.event.findMany.mockResolvedValue([]);

      const result = await service.checkin('u1', 'store1', body);
      expect(result.eligibleOffers).toEqual([]);
    });

    it('includes a STREAK offer only once the streak requirement is met', async () => {
      mockActiveStore();
      prisma.checkin.updateMany.mockResolvedValue({ count: 0 });
      prisma.checkin.create.mockResolvedValue({ id: 'checkin1', checkedInAt: new Date('2026-01-01') });
      prisma.checkin.count.mockResolvedValue(3);
      gamification.processCheckin.mockResolvedValueOnce({
        newBadges: [],
        streak: { currentStreak: 5, longestStreak: 5 },
      });
      prisma.rewardOffer.findMany.mockResolvedValue([
        {
          id: 'offer2',
          type: 'STREAK',
          title: 'Streak reward',
          description: null,
          terms: null,
          redemptionCode: 'CODE2',
          streakRequired: 3,
        },
      ]);
      prisma.event.findMany.mockResolvedValue([]);

      const result = await service.checkin('u1', 'store1', body);
      expect(result.eligibleOffers).toEqual([
        {
          id: 'offer2',
          type: 'STREAK',
          title: 'Streak reward',
          description: null,
          terms: null,
          redemptionCode: 'CODE2',
        },
      ]);
    });

    it('excludes a STREAK offer when the streak requirement is not met', async () => {
      mockActiveStore();
      prisma.checkin.updateMany.mockResolvedValue({ count: 0 });
      prisma.checkin.create.mockResolvedValue({ id: 'checkin1', checkedInAt: new Date('2026-01-01') });
      prisma.checkin.count.mockResolvedValue(3);
      gamification.processCheckin.mockResolvedValueOnce({
        newBadges: [],
        streak: { currentStreak: 1, longestStreak: 1 },
      });
      prisma.rewardOffer.findMany.mockResolvedValue([
        {
          id: 'offer2',
          type: 'STREAK',
          title: 'Streak reward',
          description: null,
          terms: null,
          redemptionCode: 'CODE2',
          streakRequired: 3,
        },
      ]);
      prisma.event.findMany.mockResolvedValue([]);

      const result = await service.checkin('u1', 'store1', body);
      expect(result.eligibleOffers).toEqual([]);
    });

    it('includes active events starting within 15 minutes and still running', async () => {
      mockActiveStore();
      prisma.checkin.updateMany.mockResolvedValue({ count: 0 });
      prisma.checkin.create.mockResolvedValue({ id: 'checkin1', checkedInAt: new Date() });
      prisma.checkin.count.mockResolvedValue(0);
      prisma.rewardOffer.findMany.mockResolvedValue([]);
      prisma.event.findMany.mockResolvedValue([
        {
          id: 'evt1',
          name: 'Draft Night',
          startsAt: new Date(Date.now() + 5 * 60 * 1000),
          endsAt: null,
          format: { name: 'Draft' },
        },
      ]);

      const result = await service.checkin('u1', 'store1', body);
      expect(result.activeEvents).toEqual([
        expect.objectContaining({ id: 'evt1', name: 'Draft Night', formatName: 'Draft' }),
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // associateCheckinEvent()
  // ---------------------------------------------------------------------------

  describe('associateCheckinEvent', () => {
    it('throws NotFoundException when there is no active checkin', async () => {
      prisma.checkin.findFirst.mockResolvedValue(null);
      prisma.event.findFirst.mockResolvedValue({
        id: 'evt1',
        name: 'Draft',
        startsAt: new Date(),
        endsAt: null,
      });

      await expect(
        service.associateCheckinEvent('u1', 'store1', 'checkin1', { eventId: 'evt1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the event does not belong to the store', async () => {
      prisma.checkin.findFirst.mockResolvedValue({ id: 'checkin1' });
      prisma.event.findFirst.mockResolvedValue(null);

      await expect(
        service.associateCheckinEvent('u1', 'store1', 'checkin1', { eventId: 'evt1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the event is not currently active', async () => {
      prisma.checkin.findFirst.mockResolvedValue({ id: 'checkin1' });
      prisma.event.findFirst.mockResolvedValue({
        id: 'evt1',
        name: 'Draft',
        startsAt: new Date(Date.now() + 60 * 60 * 1000), // starts in an hour, outside 15-min window
        endsAt: null,
      });

      await expect(
        service.associateCheckinEvent('u1', 'store1', 'checkin1', { eventId: 'evt1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('tags the checkin and upserts attendance on success', async () => {
      prisma.checkin.findFirst.mockResolvedValue({ id: 'checkin1' });
      prisma.event.findFirst.mockResolvedValue({
        id: 'evt1',
        name: 'Draft',
        startsAt: new Date(),
        endsAt: null,
      });
      prisma.checkin.update.mockResolvedValue({});
      prisma.eventAttendee.upsert.mockResolvedValue({});

      const result = await service.associateCheckinEvent('u1', 'store1', 'checkin1', { eventId: 'evt1' });

      expect(prisma.checkin.update).toHaveBeenCalledWith({
        where: { id: 'checkin1' },
        data: { eventId: 'evt1' },
      });
      expect(prisma.eventAttendee.upsert).toHaveBeenCalledWith({
        where: { userId_eventId: { userId: 'u1', eventId: 'evt1' } },
        create: { userId: 'u1', eventId: 'evt1' },
        update: {},
      });
      expect(result).toEqual({ checkinId: 'checkin1', eventId: 'evt1', eventName: 'Draft' });
    });
  });

  // ---------------------------------------------------------------------------
  // getEvents() / getEventAttendance()
  // ---------------------------------------------------------------------------

  describe('getEvents', () => {
    it('throws NotFoundException when the store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValue(null);
      await expect(service.getEvents('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('groups events by day and marks attendance', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1' });
      const startsAt = new Date('2026-03-01T18:00:00.000Z');
      prisma.event.findMany.mockResolvedValue([
        {
          id: 'evt1',
          name: 'Draft Night',
          source: 'STORE',
          description: null,
          url: null,
          eventChannelUrl: null,
          startsAt,
          endsAt: null,
          format: { name: 'Draft', slug: 'draft' },
          _count: { attendees: 2 },
        },
      ]);
      prisma.eventAttendee.findMany.mockResolvedValue([{ eventId: 'evt1' }]);
      presence.getStoreMembers.mockResolvedValue([]);

      const result = await service.getEvents('u1', 'store1');

      expect(result).toEqual([
        {
          date: '2026-03-01',
          events: [
            expect.objectContaining({
              id: 'evt1',
              name: 'Draft Night',
              isAttending: true,
              hereNowCount: 0,
            }),
          ],
        },
      ]);
    });
  });

  describe('getEventAttendance', () => {
    it('throws NotFoundException when the event is not found at the store', async () => {
      prisma.event.findFirst.mockResolvedValue(null);
      await expect(service.getEventAttendance('caller1', 'store1', 'evt1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns empty lists when there are no relevant users', async () => {
      prisma.event.findFirst.mockResolvedValue({ id: 'evt1' });
      presence.getStoreMembers.mockResolvedValue([]);
      prisma.eventAttendee.findMany.mockResolvedValue([]);
      safety.getBlockedIds.mockResolvedValue(new Set());
      prisma.checkin.findMany.mockResolvedValue([]);

      const result = await service.getEventAttendance('caller1', 'store1', 'evt1');
      expect(result).toEqual({ hereNow: [], rsvpd: [], hereNowCount: 0 });
    });

    it('excludes blocked users and separates hereNow from rsvpd-only', async () => {
      prisma.event.findFirst.mockResolvedValue({ id: 'evt1' });
      presence.getStoreMembers.mockResolvedValue(['here1']);
      prisma.eventAttendee.findMany.mockResolvedValue([{ userId: 'here1' }, { userId: 'away1' }]);
      safety.getBlockedIds.mockResolvedValue(new Set(['blocked1']));
      prisma.checkin.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'here1',
          displayName: 'Here',
          pronouns: null,
          bio: null,
          avatarColors: [],
          commander: null,
          powerLevel: null,
          vibes: [],
          formats: [],
          privacySettings: { discoverable: true },
        },
        {
          id: 'away1',
          displayName: 'Away',
          pronouns: null,
          bio: null,
          avatarColors: [],
          commander: null,
          powerLevel: null,
          vibes: [],
          formats: [],
          privacySettings: { discoverable: true },
        },
      ]);

      const result = await service.getEventAttendance('caller1', 'store1', 'evt1');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: expect.arrayContaining(['here1', 'away1']) } }),
        }),
      );
      const calledIds = (prisma.user.findMany.mock.calls[0][0].where.id.in as string[]).slice().sort();
      expect(calledIds).toEqual(['away1', 'here1']);
      expect(result.hereNow).toEqual([expect.objectContaining({ id: 'here1', isHereNow: true })]);
      expect(result.rsvpd).toEqual([expect.objectContaining({ id: 'away1', isHereNow: false })]);
      expect(result.hereNowCount).toBe(1);
    });

    it('filters out users who have opted out of discoverability', async () => {
      prisma.event.findFirst.mockResolvedValue({ id: 'evt1' });
      presence.getStoreMembers.mockResolvedValue(['here1']);
      prisma.eventAttendee.findMany.mockResolvedValue([{ userId: 'here1' }]);
      safety.getBlockedIds.mockResolvedValue(new Set());
      prisma.checkin.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'here1',
          displayName: 'Here',
          pronouns: null,
          bio: null,
          avatarColors: [],
          commander: null,
          powerLevel: null,
          vibes: [],
          formats: [],
          privacySettings: { discoverable: false },
        },
      ]);

      const result = await service.getEventAttendance('caller1', 'store1', 'evt1');
      expect(result).toEqual({ hereNow: [], rsvpd: [], hereNowCount: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // attendEvent() / unattendEvent()
  // ---------------------------------------------------------------------------

  describe('attendEvent', () => {
    it('throws NotFoundException when the event does not exist at the store', async () => {
      prisma.event.findFirst.mockResolvedValue(null);
      await expect(service.attendEvent('u1', 'store1', 'evt1')).rejects.toThrow(NotFoundException);
    });

    it('upserts attendance and schedules reminders', async () => {
      const startsAt = new Date('2026-04-01T18:00:00.000Z');
      prisma.event.findFirst.mockResolvedValue({
        id: 'evt1',
        name: 'Draft Night',
        startsAt,
        store: { id: 'store1', name: 'Store 1', timezone: 'America/Los_Angeles' },
      });
      prisma.eventAttendee.upsert.mockResolvedValue({});

      const result = await service.attendEvent('u1', 'store1', 'evt1');

      expect(prisma.eventAttendee.upsert).toHaveBeenCalledWith({
        where: { userId_eventId: { userId: 'u1', eventId: 'evt1' } },
        create: { userId: 'u1', eventId: 'evt1' },
        update: {},
      });
      expect(eventReminders.scheduleReminders).toHaveBeenCalledWith('u1', {
        eventId: 'evt1',
        eventName: 'Draft Night',
        startsAt,
        storeId: 'store1',
        storeName: 'Store 1',
        timezone: 'America/Los_Angeles',
      });
      expect(result).toEqual({ eventId: 'evt1', eventName: 'Draft Night' });
    });
  });

  describe('unattendEvent', () => {
    it('throws NotFoundException when the event does not exist at the store', async () => {
      prisma.event.findFirst.mockResolvedValue(null);
      await expect(service.unattendEvent('u1', 'store1', 'evt1')).rejects.toThrow(NotFoundException);
    });

    it('removes attendance and cancels reminders', async () => {
      prisma.event.findFirst.mockResolvedValue({ id: 'evt1', name: 'Draft Night' });
      prisma.eventAttendee.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unattendEvent('u1', 'store1', 'evt1');

      expect(prisma.eventAttendee.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', eventId: 'evt1' },
      });
      expect(eventReminders.cancelReminders).toHaveBeenCalledWith('u1', 'evt1');
      expect(result).toEqual({ eventId: 'evt1', eventName: 'Draft Night' });
    });
  });

  // ---------------------------------------------------------------------------
  // notifyWhenActive() / getLeaderboard()
  // ---------------------------------------------------------------------------

  describe('notifyWhenActive', () => {
    it('delegates to presence.subscribeNotifyWhenActive', async () => {
      const result = await service.notifyWhenActive('u1', 'store1', 3);
      expect(presence.subscribeNotifyWhenActive).toHaveBeenCalledWith('u1', 'store1', 3);
      expect(result).toEqual({ storeId: 'store1', threshold: 3 });
    });
  });

  describe('getLeaderboard', () => {
    it('merges the streak leaderboard and wins leaderboard', async () => {
      gamification.getLeaderboard.mockResolvedValue({ entries: ['streak-entry'] });
      gamification.getWinsLeaderboard.mockResolvedValue(['wins-entry']);

      const result = await service.getLeaderboard('caller1', 'store1');
      expect(result).toEqual({ entries: ['streak-entry'], winsLeaderboard: ['wins-entry'] });
    });
  });

  // ---------------------------------------------------------------------------
  // suggestStore()
  // ---------------------------------------------------------------------------

  describe('suggestStore', () => {
    const body = { name: 'New Store', lat: 40.0, lng: -73.0 };

    it('throws BadRequestException once the 7-day submission limit is reached', async () => {
      prisma.store.count.mockResolvedValue(3);
      await expect(service.suggestStore('caller1', body)).rejects.toThrow(BadRequestException);
    });

    it('creates the store, sets geom, confirms, and checks auto-approve', async () => {
      prisma.store.count.mockResolvedValueOnce(0); // submission-limit check
      prisma.store.create.mockResolvedValue({ id: 'store1', name: 'New Store' });
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.storeConfirmation.create.mockResolvedValue({});
      // checkAutoApprove internals:
      prisma.store.findUnique.mockResolvedValue({ status: 'PROPOSED', submittedById: 'caller1', name: 'New Store' });
      prisma.storeConfirmation.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      const result = await service.suggestStore('caller1', body);

      expect(prisma.store.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'New Store', status: 'PROPOSED' }) }),
      );
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.storeConfirmation.create).toHaveBeenCalledWith({
        data: { storeId: 'store1', userId: 'caller1', proximity: false },
      });
      expect(result).toEqual({ id: 'store1', name: 'New Store', status: 'proposed', alreadyConfirmed: true });
    });

    it('marks submitter proximity true when submitter coords are within 500m', async () => {
      prisma.store.count.mockResolvedValueOnce(0);
      prisma.store.create.mockResolvedValue({ id: 'store1', name: 'New Store' });
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.storeConfirmation.create.mockResolvedValue({});
      prisma.store.findUnique.mockResolvedValue({ status: 'ACTIVE', submittedById: null, name: 'New Store' });
      prisma.storeConfirmation.count.mockResolvedValue(0);

      await service.suggestStore('caller1', { ...body, submitterLat: 40.0001, submitterLng: -73.0001 });

      expect(prisma.storeConfirmation.create).toHaveBeenCalledWith({
        data: { storeId: 'store1', userId: 'caller1', proximity: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // confirmStore()
  // ---------------------------------------------------------------------------

  describe('confirmStore', () => {
    it('throws NotFoundException when the store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValue(null);
      await expect(service.confirmStore('caller1', 'store1', {})).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the store is not PROPOSED', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', status: 'ACTIVE' });
      await expect(service.confirmStore('caller1', 'store1', {})).rejects.toThrow(BadRequestException);
    });

    it('short-circuits and returns the current count when already confirmed', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1', status: 'PROPOSED' });
      prisma.storeConfirmation.findUnique.mockResolvedValue({ id: 'confirmation1' });
      prisma.storeConfirmation.count.mockResolvedValue(2);

      const result = await service.confirmStore('caller1', 'store1', {});

      expect(result).toEqual({ confirmationCount: 2, status: 'PROPOSED' });
      expect(prisma.storeConfirmation.create).not.toHaveBeenCalled();
    });

    it('runs the proximity query when lat/lng are given and creates a new confirmation', async () => {
      prisma.store.findUnique
        .mockResolvedValueOnce({ id: 'store1', status: 'PROPOSED' }) // initial lookup
        .mockResolvedValueOnce({ status: 'PROPOSED', submittedById: null, name: 'Store 1' }) // checkAutoApprove's own lookup
        .mockResolvedValueOnce({ status: 'ACTIVE' }); // post-confirm re-check
      prisma.storeConfirmation.findUnique.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([{ within: true }]);
      prisma.storeConfirmation.create.mockResolvedValue({});
      prisma.storeConfirmation.count
        .mockResolvedValueOnce(3) // checkAutoApprove total
        .mockResolvedValueOnce(1) // checkAutoApprove proximity count -> triggers auto-approve
        .mockResolvedValueOnce(3); // final confirmationCount
      prisma.store.update.mockResolvedValue({});

      const result = await service.confirmStore('caller1', 'store1', { lat: 40.0, lng: -73.0 });

      expect(prisma.storeConfirmation.create).toHaveBeenCalledWith({
        data: { storeId: 'store1', userId: 'caller1', proximity: true },
      });
      expect(prisma.store.update).toHaveBeenCalledWith({
        where: { id: 'store1' },
        data: { status: 'ACTIVE' },
      });
      expect(result).toEqual({ confirmationCount: 3, status: 'ACTIVE' });
    });
  });

  // ---------------------------------------------------------------------------
  // checkAutoApprove()
  // ---------------------------------------------------------------------------

  describe('checkAutoApprove', () => {
    it('does nothing when the store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValue(null);
      await service.checkAutoApprove('store1');
      expect(prisma.store.update).not.toHaveBeenCalled();
    });

    it('does nothing when the store is not PROPOSED', async () => {
      prisma.store.findUnique.mockResolvedValue({ status: 'ACTIVE', submittedById: null, name: 'S' });
      prisma.storeConfirmation.count.mockResolvedValue(10);
      await service.checkAutoApprove('store1');
      expect(prisma.store.update).not.toHaveBeenCalled();
    });

    it('does not approve below the threshold (fewer than 3 confirmations, or 3+ without proximity)', async () => {
      prisma.store.findUnique.mockResolvedValue({ status: 'PROPOSED', submittedById: 'u1', name: 'S' });
      prisma.storeConfirmation.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(0); // proximity count

      await service.checkAutoApprove('store1');
      expect(prisma.store.update).not.toHaveBeenCalled();
    });

    it('approves once 3 confirmations include at least one proximity confirmation', async () => {
      prisma.store.findUnique.mockResolvedValue({ status: 'PROPOSED', submittedById: 'u1', name: 'Store 1' });
      prisma.storeConfirmation.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
      prisma.store.update.mockResolvedValue({});

      await service.checkAutoApprove('store1');

      expect(prisma.store.update).toHaveBeenCalledWith({
        where: { id: 'store1' },
        data: { status: 'ACTIVE' },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ kind: 'BROADCAST', data: { type: 'store_approved', storeId: 'store1' } }),
      );
    });

    it('approves once 5+ confirmations regardless of proximity', async () => {
      prisma.store.findUnique.mockResolvedValue({ status: 'PROPOSED', submittedById: null, name: 'Store 1' });
      prisma.storeConfirmation.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
      prisma.store.update.mockResolvedValue({});

      await service.checkAutoApprove('store1');

      expect(prisma.store.update).toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
