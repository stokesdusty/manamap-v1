import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OnboardingSubmit } from '@manamap/shared';
import { MeService } from '../me.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EndorsementsService } from '../../endorsements/endorsements.service';
import { EventRemindersService } from '../../event-reminders/event-reminders.service';
import { PresenceService } from '../../presence/presence.service';
import { LfgService } from '../../lfg/lfg.service';

function makeEndorsementsMock() {
  return {
    getSummary: jest.fn().mockResolvedValue({ total: 0, byTag: [] }),
  };
}

function makeEventRemindersMock() {
  return { cancelReminders: jest.fn().mockResolvedValue(undefined) };
}

function makePresenceMock() {
  return { checkout: jest.fn().mockResolvedValue(undefined) };
}

function makeLfgMock() {
  return { remove: jest.fn().mockResolvedValue(undefined) };
}

function makePrismaMock() {
  return {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    privacySettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    deckLink: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    pushToken: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
    },
    userBadge: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    streak: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    gameLog: {
      findMany: jest.fn(),
    },
    socialLink: { findMany: jest.fn(), deleteMany: jest.fn() },
    checkin: { findMany: jest.fn(), deleteMany: jest.fn() },
    eventAttendee: { findMany: jest.fn(), deleteMany: jest.fn() },
    connection: { findMany: jest.fn(), deleteMany: jest.fn() },
    encounter: { findMany: jest.fn() },
    gamePlayer: { findMany: jest.fn() },
    endorsement: { findMany: jest.fn() },
    offerRedemption: { findMany: jest.fn() },
    block: { findMany: jest.fn() },
    report: { findMany: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    notification: { deleteMany: jest.fn() },
    identity: { deleteMany: jest.fn() },
    questProgress: { deleteMany: jest.fn() },
    storeConfirmation: { deleteMany: jest.fn() },
    storeOwnership: { deleteMany: jest.fn() },
  };
}

describe('MeService', () => {
  let service: MeService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let endorsements: ReturnType<typeof makeEndorsementsMock>;
  let eventReminders: ReturnType<typeof makeEventRemindersMock>;
  let presence: ReturnType<typeof makePresenceMock>;
  let lfg: ReturnType<typeof makeLfgMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    endorsements = makeEndorsementsMock();
    eventReminders = makeEventRemindersMock();
    presence = makePresenceMock();
    lfg = makeLfgMock();

    const module = await Test.createTestingModule({
      providers: [
        MeService,
        { provide: PrismaService, useValue: prisma },
        { provide: EndorsementsService, useValue: endorsements },
        { provide: EventRemindersService, useValue: eventReminders },
        { provide: PresenceService, useValue: presence },
        { provide: LfgService, useValue: lfg },
      ],
    }).compile();

    service = module.get(MeService);
  });

  // -------------------------------------------------------------------------
  // getProfile
  // -------------------------------------------------------------------------

  describe('getProfile', () => {
    it('returns the user with an endorsements summary when found', async () => {
      const user = { id: 'u1', displayName: 'Alice' };
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(service.getProfile('u1')).resolves.toEqual({
        ...user,
        endorsements: { total: 0, byTag: [] },
      });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // updateProfile — sparse update (only defined fields forwarded)
  // -------------------------------------------------------------------------

  describe('updateProfile', () => {
    it('forwards only the fields that are present in the DTO', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.updateProfile('u1', { displayName: 'Bob' });

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.displayName).toBe('Bob');
      expect('bio' in data).toBe(false);
      expect('avatarColors' in data).toBe(false);
    });

    it('forwards multiple fields when all are provided', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.updateProfile('u1', { displayName: 'Bob', bio: 'Hi', avatarColors: ['W'] });

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.displayName).toBe('Bob');
      expect(data.bio).toBe('Hi');
      expect(data.avatarColors).toEqual(['W']);
    });
  });

  // -------------------------------------------------------------------------
  // getPrivacy
  // -------------------------------------------------------------------------

  describe('getPrivacy', () => {
    it('returns the stored record when one exists', async () => {
      const stored = {
        discoverable: false,
        showDiscord: true,
        showDecks: true,
        showMetHistory: false,
        storeMessages: true,
        shareNameWithContacts: false,
        eventReminders: true,
      };
      prisma.privacySettings.findUnique.mockResolvedValue(stored);

      const result = await service.getPrivacy('u1');
      expect(result).toEqual(stored);
    });

    it('returns safe defaults when no record exists', async () => {
      prisma.privacySettings.findUnique.mockResolvedValue(null);

      const result = await service.getPrivacy('u1');
      expect(result).toMatchObject({
        discoverable: true,
        showDiscord: true,
        showDecks: true,
        showMetHistory: true,
        storeMessages: true,
        shareNameWithContacts: false,
        eventReminders: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // updatePrivacy
  // -------------------------------------------------------------------------

  describe('updatePrivacy', () => {
    it('upserts with only defined patch fields', async () => {
      prisma.privacySettings.upsert.mockResolvedValue({});
      await service.updatePrivacy('u1', { discoverable: false });

      const { update } = prisma.privacySettings.upsert.mock.calls[0][0];
      expect(update.discoverable).toBe(false);
      expect('showDecks' in update).toBe(false);
    });

    it('applies ?? true defaults in the create branch for omitted fields', async () => {
      prisma.privacySettings.upsert.mockResolvedValue({});
      await service.updatePrivacy('u1', { discoverable: false });

      const { create } = prisma.privacySettings.upsert.mock.calls[0][0];
      expect(create.discoverable).toBe(false); // provided
      expect(create.showDiscord).toBe(true); // defaulted
      expect(create.shareNameWithContacts).toBe(false); // default false
    });
  });

  // -------------------------------------------------------------------------
  // Deck CRUD
  // -------------------------------------------------------------------------

  describe('getDecks', () => {
    it('lowercases the site field', async () => {
      prisma.deckLink.findMany.mockResolvedValue([
        { id: 'd1', name: 'Deck A', site: 'MOXFIELD', url: 'https://moxfield.com/x' },
      ]);

      const decks = await service.getDecks('u1');
      expect(decks[0].site).toBe('moxfield');
    });

    it('returns null for site when the deck has no site', async () => {
      prisma.deckLink.findMany.mockResolvedValue([
        { id: 'd1', name: 'Deck B', site: null, url: null },
      ]);

      const decks = await service.getDecks('u1');
      expect(decks[0].site).toBeNull();
    });
  });

  describe('createDeck', () => {
    it('derives the site from the URL and stores it uppercased', async () => {
      prisma.deckLink.create.mockResolvedValue({
        id: 'd1',
        name: 'Storm',
        site: 'MOXFIELD',
        url: 'https://moxfield.com/decks/abc',
      });

      await service.createDeck('u1', { name: 'Storm', url: 'https://moxfield.com/decks/abc' });

      const data = prisma.deckLink.create.mock.calls[0][0].data;
      expect(data.site).toBe('MOXFIELD');
    });

    it('sets site to null when no URL is provided', async () => {
      prisma.deckLink.create.mockResolvedValue({
        id: 'd1',
        name: 'Mystery',
        site: null,
        url: null,
      });

      await service.createDeck('u1', { name: 'Mystery' });

      const data = prisma.deckLink.create.mock.calls[0][0].data;
      expect(data.site).toBeNull();
      expect(data.url).toBeNull();
    });

    it('returns the deck with a lowercased site', async () => {
      prisma.deckLink.create.mockResolvedValue({
        id: 'd1',
        name: 'Storm',
        site: 'MOXFIELD',
        url: 'https://moxfield.com/decks/abc',
      });

      const result = await service.createDeck('u1', {
        name: 'Storm',
        url: 'https://moxfield.com/decks/abc',
      });
      expect(result.site).toBe('moxfield');
    });
  });

  describe('updateDeck', () => {
    it('throws NotFoundException when the deck does not belong to the user', async () => {
      prisma.deckLink.findFirst.mockResolvedValue(null);
      await expect(service.updateDeck('u1', 'deck99', { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('re-derives site when the URL changes', async () => {
      prisma.deckLink.findFirst.mockResolvedValue({ id: 'deck1' });
      prisma.deckLink.update.mockResolvedValue({
        id: 'deck1',
        name: 'Deck',
        site: 'ARCHIDEKT',
        url: 'https://archidekt.com/decks/1',
      });

      await service.updateDeck('u1', 'deck1', { url: 'https://archidekt.com/decks/1' });

      const data = prisma.deckLink.update.mock.calls[0][0].data;
      expect(data.site).toBe('ARCHIDEKT');
    });

    it('does not include url/site in the patch when url is not in the DTO', async () => {
      prisma.deckLink.findFirst.mockResolvedValue({ id: 'deck1' });
      prisma.deckLink.update.mockResolvedValue({
        id: 'deck1',
        name: 'Renamed',
        site: 'MOXFIELD',
        url: 'https://moxfield.com/x',
      });

      await service.updateDeck('u1', 'deck1', { name: 'Renamed' });

      const data = prisma.deckLink.update.mock.calls[0][0].data;
      expect(data.name).toBe('Renamed');
      expect('url' in data).toBe(false);
      expect('site' in data).toBe(false);
    });
  });

  describe('deleteDeck', () => {
    it('throws NotFoundException when the deck does not belong to the user', async () => {
      prisma.deckLink.findFirst.mockResolvedValue(null);
      await expect(service.deleteDeck('u1', 'deck99')).rejects.toThrow(NotFoundException);
    });

    it('deletes the deck when it exists and belongs to the user', async () => {
      prisma.deckLink.findFirst.mockResolvedValue({ id: 'deck1' });
      prisma.deckLink.delete.mockResolvedValue({});

      await service.deleteDeck('u1', 'deck1');

      expect(prisma.deckLink.delete).toHaveBeenCalledWith({ where: { id: 'deck1' } });
    });
  });

  // -------------------------------------------------------------------------
  // getStreaksSummary
  // -------------------------------------------------------------------------

  describe('getStreaksSummary', () => {
    it('returns all zeros when the user has no streaks', async () => {
      prisma.streak.findMany.mockResolvedValue([]);
      await expect(service.getStreaksSummary('u1')).resolves.toEqual({
        bestCurrentStreak: 0,
        bestLongestStreak: 0,
        totalCheckins: 0,
      });
    });

    it('picks the highest currentStreak across all stores', async () => {
      prisma.streak.findMany.mockResolvedValue([
        { currentStreak: 2, longestStreak: 5, totalCheckins: 10 },
        { currentStreak: 7, longestStreak: 7, totalCheckins: 20 },
      ]);

      const result = await service.getStreaksSummary('u1');
      expect(result.bestCurrentStreak).toBe(7);
    });

    it('picks the highest longestStreak across all stores', async () => {
      prisma.streak.findMany.mockResolvedValue([
        { currentStreak: 1, longestStreak: 12, totalCheckins: 40 },
        { currentStreak: 3, longestStreak: 5, totalCheckins: 15 },
      ]);

      const result = await service.getStreaksSummary('u1');
      expect(result.bestLongestStreak).toBe(12);
    });

    it('sums totalCheckins across all stores', async () => {
      prisma.streak.findMany.mockResolvedValue([
        { currentStreak: 1, longestStreak: 1, totalCheckins: 15 },
        { currentStreak: 1, longestStreak: 1, totalCheckins: 25 },
        { currentStreak: 1, longestStreak: 1, totalCheckins: 10 },
      ]);

      const result = await service.getStreaksSummary('u1');
      expect(result.totalCheckins).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // getGameStats
  // -------------------------------------------------------------------------

  describe('getGameStats', () => {
    it('returns zeros and an empty byDeck when the user has no confirmed games', async () => {
      prisma.gameLog.findMany.mockResolvedValue([]);

      const result = await service.getGameStats('u1');

      expect(result).toEqual({ games: 0, wins: 0, losses: 0, winRate: 0, byDeck: [] });
    });

    it('counts a game as a win when winnerId equals userId', async () => {
      prisma.gameLog.findMany.mockResolvedValue([{ winnerId: 'u1', players: [{ deck: null }] }]);

      const result = await service.getGameStats('u1');
      expect(result.wins).toBe(1);
      expect(result.losses).toBe(0);
    });

    it('counts a game as a loss when winnerId differs from userId', async () => {
      prisma.gameLog.findMany.mockResolvedValue([{ winnerId: 'other', players: [{ deck: null }] }]);

      const result = await service.getGameStats('u1');
      expect(result.wins).toBe(0);
      expect(result.losses).toBe(1);
    });

    it('computes winRate as wins / total', async () => {
      prisma.gameLog.findMany.mockResolvedValue([
        { winnerId: 'u1', players: [{ deck: null }] },
        { winnerId: 'u1', players: [{ deck: null }] },
        { winnerId: 'other', players: [{ deck: null }] },
      ]);

      const result = await service.getGameStats('u1');
      expect(result.winRate).toBeCloseTo(2 / 3);
    });

    it('returns winRate 0 when there are no games (no division by zero)', async () => {
      prisma.gameLog.findMany.mockResolvedValue([]);
      const result = await service.getGameStats('u1');
      expect(result.winRate).toBe(0);
    });

    it('accumulates per-deck wins and losses', async () => {
      prisma.gameLog.findMany.mockResolvedValue([
        { winnerId: 'u1', players: [{ deck: 'Storm' }] },
        { winnerId: 'u1', players: [{ deck: 'Storm' }] },
        { winnerId: 'other', players: [{ deck: 'Storm' }] },
      ]);

      const result = await service.getGameStats('u1');
      const stormEntry = result.byDeck.find((d) => d.deck === 'Storm');
      expect(stormEntry).toBeDefined();
      expect(stormEntry!.wins).toBe(2);
      expect(stormEntry!.losses).toBe(1);
    });

    it('computes per-deck rate as deckWins / deckTotal', async () => {
      prisma.gameLog.findMany.mockResolvedValue([
        { winnerId: 'u1', players: [{ deck: 'Burn' }] },
        { winnerId: 'other', players: [{ deck: 'Burn' }] },
      ]);

      const result = await service.getGameStats('u1');
      const burnEntry = result.byDeck.find((d) => d.deck === 'Burn');
      expect(burnEntry!.rate).toBeCloseTo(0.5);
    });

    it('excludes games played with no deck from byDeck', async () => {
      prisma.gameLog.findMany.mockResolvedValue([
        { winnerId: 'u1', players: [{ deck: null }] },
        { winnerId: 'u1', players: [{ deck: null }] },
      ]);

      const result = await service.getGameStats('u1');
      expect(result.byDeck).toHaveLength(0);
      expect(result.wins).toBe(2);
    });

    it('tracks multiple decks independently', async () => {
      prisma.gameLog.findMany.mockResolvedValue([
        { winnerId: 'u1', players: [{ deck: 'Burn' }] },
        { winnerId: 'other', players: [{ deck: 'Control' }] },
        { winnerId: 'u1', players: [{ deck: 'Control' }] },
      ]);

      const result = await service.getGameStats('u1');
      expect(result.byDeck).toHaveLength(2);
      const burnEntry = result.byDeck.find((d) => d.deck === 'Burn');
      const controlEntry = result.byDeck.find((d) => d.deck === 'Control');
      expect(burnEntry!.wins).toBe(1);
      expect(controlEntry!.losses).toBe(1);
      expect(controlEntry!.wins).toBe(1);
    });

    it('sorts byDeck by total games played (most games first)', async () => {
      prisma.gameLog.findMany.mockResolvedValue([
        { winnerId: 'u1', players: [{ deck: 'A' }] },
        { winnerId: 'u1', players: [{ deck: 'B' }] },
        { winnerId: 'u1', players: [{ deck: 'B' }] },
        { winnerId: 'u1', players: [{ deck: 'B' }] },
      ]);

      const result = await service.getGameStats('u1');
      expect(result.byDeck[0].deck).toBe('B'); // 3 games
      expect(result.byDeck[1].deck).toBe('A'); // 1 game
    });
  });

  // -------------------------------------------------------------------------
  // setHomeStore
  // -------------------------------------------------------------------------

  describe('setHomeStore', () => {
    it('throws NotFoundException when the storeId does not exist', async () => {
      prisma.store.findUnique.mockResolvedValue(null);

      await expect(service.setHomeStore('u1', { storeId: 'ghost' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates homeStoreId when the store exists', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'store1' });
      prisma.user.update.mockResolvedValue({});

      await service.setHomeStore('u1', { storeId: 'store1' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { homeStoreId: 'store1' } }),
      );
    });

    it('clears homeStoreId without a DB lookup when storeId is null', async () => {
      prisma.user.update.mockResolvedValue({});

      await service.setHomeStore('u1', { storeId: null });

      expect(prisma.store.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { homeStoreId: null } }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // submitOnboarding
  // -------------------------------------------------------------------------

  describe('submitOnboarding', () => {
    const BASE_ONBOARDING: OnboardingSubmit = {
      displayName: 'Alice',
      avatarColors: ['W', 'U'],
      formats: ['commander'],
      discoverable: true,
    };

    it('throws NotFoundException when homeStoreId is provided but the store does not exist', async () => {
      prisma.store.findUnique.mockResolvedValue(null);

      await expect(
        service.submitOnboarding('u1', { ...BASE_ONBOARDING, homeStoreId: 'ghost' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('runs the update inside a transaction', async () => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({ id: 'u1' }) },
        privacySettings: { upsert: jest.fn().mockResolvedValue({}) },
        deckLink: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));

      await service.submitOnboarding('u1', BASE_ONBOARDING);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ displayName: 'Alice' }) }),
      );
    });

    it('creates deck links inside the transaction when decks are provided', async () => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({ id: 'u1' }) },
        privacySettings: { upsert: jest.fn().mockResolvedValue({}) },
        deckLink: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));

      await service.submitOnboarding('u1', {
        ...BASE_ONBOARDING,
        decks: [{ name: 'Storm', url: 'https://moxfield.com/decks/abc' }],
      });

      expect(tx.deckLink.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ name: 'Storm', userId: 'u1' })]),
        }),
      );
    });

    it('skips deck creation when no decks are provided', async () => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({ id: 'u1' }) },
        privacySettings: { upsert: jest.fn().mockResolvedValue({}) },
        deckLink: { createMany: jest.fn() },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));

      await service.submitOnboarding('u1', BASE_ONBOARDING);

      expect(tx.deckLink.createMany).not.toHaveBeenCalled();
    });

    it('sets onboardedAt to a recent Date', async () => {
      const before = new Date();
      const tx = {
        user: { update: jest.fn().mockResolvedValue({ id: 'u1' }) },
        privacySettings: { upsert: jest.fn().mockResolvedValue({}) },
        deckLink: { createMany: jest.fn() },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));

      await service.submitOnboarding('u1', BASE_ONBOARDING);

      const onboardedAt: Date = tx.user.update.mock.calls[0][0].data.onboardedAt;
      expect(onboardedAt).toBeInstanceOf(Date);
      expect(onboardedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  // -------------------------------------------------------------------------
  // exportData
  // -------------------------------------------------------------------------

  describe('exportData', () => {
    function stubAllQueries() {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', displayName: 'Alice' });
      jest.spyOn(service, 'getPrivacy').mockResolvedValue({} as never);
      jest.spyOn(service, 'getDecks').mockResolvedValue([]);
      jest.spyOn(service, 'getBadges').mockResolvedValue([]);
      prisma.socialLink.findMany.mockResolvedValue([]);
      prisma.streak.findMany.mockResolvedValue([]);
      prisma.checkin.findMany.mockResolvedValue([]);
      prisma.eventAttendee.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([]);
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.gamePlayer.findMany.mockResolvedValue([]);
      prisma.endorsement.findMany.mockResolvedValue([]);
      prisma.offerRedemption.findMany.mockResolvedValue([]);
      prisma.block.findMany.mockResolvedValue([]);
      prisma.report.findMany.mockResolvedValue([]);
    }

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.exportData('ghost')).rejects.toThrow(NotFoundException);
    });

    it('includes an exportedAt timestamp and the profile with endorsements', async () => {
      stubAllQueries();
      const result = await service.exportData('u1');
      expect(typeof result.exportedAt).toBe('string');
      expect(result.profile).toMatchObject({ id: 'u1', endorsements: { total: 0, byTag: [] } });
    });

    it('tags sent and received connections with direction and lowercases status', async () => {
      stubAllQueries();
      prisma.connection.findMany
        .mockResolvedValueOnce([
          {
            id: 'c1',
            status: 'ACCEPTED',
            createdAt: new Date('2026-01-01'),
            addressee: { id: 'u2', displayName: 'Bob' },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'c2',
            status: 'PENDING',
            createdAt: new Date('2026-01-02'),
            requester: { id: 'u3', displayName: 'Cara' },
          },
        ]);

      const result = await service.exportData('u1');
      expect(result.connections).toEqual([
        { id: 'c1', otherUserId: 'u2', otherUserName: 'Bob', direction: 'sent', status: 'accepted', createdAt: new Date('2026-01-01') },
        { id: 'c2', otherUserId: 'u3', otherUserName: 'Cara', direction: 'received', status: 'pending', createdAt: new Date('2026-01-02') },
      ]);
    });

    it('derives isWinner per game from winnerId', async () => {
      stubAllQueries();
      prisma.gamePlayer.findMany.mockResolvedValue([
        {
          deck: 'Storm',
          gameLog: {
            id: 'g1',
            storeId: null,
            format: 'commander',
            status: 'CONFIRMED',
            winnerId: 'u1',
            createdAt: new Date('2026-01-01'),
          },
        },
        {
          deck: 'Burn',
          gameLog: {
            id: 'g2',
            storeId: null,
            format: 'modern',
            status: 'CONFIRMED',
            winnerId: 'other',
            createdAt: new Date('2026-01-02'),
          },
        },
      ]);

      const result = await service.exportData('u1');
      expect(result.games).toEqual([
        expect.objectContaining({ id: 'g1', isWinner: true }),
        expect.objectContaining({ id: 'g2', isWinner: false }),
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // deleteAccount
  // -------------------------------------------------------------------------

  describe('deleteAccount', () => {
    function stubTransaction() {
      const tx = {
        refreshToken: { deleteMany: jest.fn() },
        pushToken: { deleteMany: jest.fn() },
        notification: { deleteMany: jest.fn() },
        identity: { deleteMany: jest.fn() },
        deckLink: { deleteMany: jest.fn() },
        socialLink: { deleteMany: jest.fn() },
        questProgress: { deleteMany: jest.fn() },
        storeConfirmation: { deleteMany: jest.fn() },
        eventAttendee: { deleteMany: jest.fn() },
        checkin: { deleteMany: jest.fn() },
        streak: { deleteMany: jest.fn() },
        userBadge: { deleteMany: jest.fn() },
        storeOwnership: { deleteMany: jest.fn() },
        privacySettings: { deleteMany: jest.fn() },
        connection: { deleteMany: jest.fn() },
        user: { update: jest.fn().mockResolvedValue({}) },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));
      return tx;
    }

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.deleteAccount('ghost')).rejects.toThrow(NotFoundException);
    });

    it('is a no-op when the account is already deleted', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: new Date() });
      await service.deleteAccount('u1');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cancels reminders for every event the user is attending', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: null });
      prisma.eventAttendee.findMany.mockResolvedValue([{ eventId: 'e1' }, { eventId: 'e2' }]);
      stubTransaction();

      await service.deleteAccount('u1');

      expect(eventReminders.cancelReminders).toHaveBeenCalledWith('u1', 'e1');
      expect(eventReminders.cancelReminders).toHaveBeenCalledWith('u1', 'e2');
    });

    it('clears ephemeral presence and LFG state', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: null });
      prisma.eventAttendee.findMany.mockResolvedValue([]);
      stubTransaction();

      await service.deleteAccount('u1');

      expect(presence.checkout).toHaveBeenCalledWith('u1');
      expect(lfg.remove).toHaveBeenCalledWith('u1');
    });

    it('does not block deletion when redis cleanup fails', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: null });
      prisma.eventAttendee.findMany.mockResolvedValue([]);
      presence.checkout.mockRejectedValue(new Error('redis down'));
      const tx = stubTransaction();

      await service.deleteAccount('u1');

      expect(tx.user.update).toHaveBeenCalled();
    });

    it('hard-deletes personal/session data and anonymizes the user row', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: null });
      prisma.eventAttendee.findMany.mockResolvedValue([]);
      const tx = stubTransaction();

      await service.deleteAccount('u1');

      for (const model of [
        'refreshToken',
        'pushToken',
        'notification',
        'identity',
        'deckLink',
        'socialLink',
        'questProgress',
        'storeConfirmation',
        'eventAttendee',
        'checkin',
        'streak',
        'userBadge',
        'storeOwnership',
        'privacySettings',
      ] as const) {
        expect(tx[model].deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      }

      const updateData = tx.user.update.mock.calls[0][0].data;
      expect(updateData.email).toBe('deleted-u1@manamap.invalid');
      expect(updateData.displayName).toBe('Deleted User');
      expect(updateData.name).toBeNull();
      expect(updateData.homeStoreId).toBeNull();
      expect(updateData.lastLat).toBeNull();
      expect(updateData.role).toBe('USER');
      expect(updateData.deletedAt).toBeInstanceOf(Date);
    });

    it('only deletes PENDING connections, leaving accepted ones intact for the other party', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: null });
      prisma.eventAttendee.findMany.mockResolvedValue([]);
      const tx = stubTransaction();

      await service.deleteAccount('u1');

      expect(tx.connection.deleteMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', OR: [{ requesterId: 'u1' }, { addresseeId: 'u1' }] },
      });
    });
  });
});
