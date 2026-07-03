import { Test } from '@nestjs/testing';
import { DiscoveryService } from '../discovery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS } from '../../redis/redis.module';
import { SafetyService } from '../../safety/safety.service';
import { SocialsService } from '../../socials/socials.service';

function makePrismaMock() {
  return {
    $queryRaw: jest.fn(),
    store: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    privacySettings: { findUnique: jest.fn() },
    encounter: { findMany: jest.fn(), createMany: jest.fn() },
    connection: { findMany: jest.fn() },
    event: { findMany: jest.fn() },
    eventAttendee: { findMany: jest.fn() },
  };
}

function makeRedisMock() {
  return {
    get: jest.fn(),
    zrange: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(0),
  };
}

function makeProfile(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    displayName: `User ${id}`,
    pronouns: null,
    bio: null,
    avatarColors: [] as string[],
    commander: null,
    powerLevel: null,
    vibes: [] as string[],
    formats: [] as string[],
    tradeWants: [],
    tradeHaves: [],
    privacySettings: { discoverable: true },
    ...overrides,
  };
}

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let safety: { getBlockedIds: jest.Mock };
  let socials: { publicSocialsBatch: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    safety = { getBlockedIds: jest.fn().mockResolvedValue(new Set()) };
    socials = { publicSocialsBatch: jest.fn().mockResolvedValue(new Map()) };

    // Default: caller has no store presence and no fresh location
    redis.get.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.privacySettings.findUnique.mockResolvedValue({ discoverable: true });

    const module = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS, useValue: redis },
        { provide: SafetyService, useValue: safety },
        { provide: SocialsService, useValue: socials },
      ],
    }).compile();

    service = module.get(DiscoveryService);
  });

  // ---------------------------------------------------------------------------
  // nearby()
  // ---------------------------------------------------------------------------

  describe('nearby', () => {
    it('returns no players when the caller has neither store presence nor a fresh location', async () => {
      const result = await service.nearby('caller1');
      expect(result).toEqual({ storeId: null, storeName: null, players: [] });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('unions store members into the player list and excludes blocked users', async () => {
      redis.get.mockResolvedValue('store1'); // presence
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['member1', 'blockedMember']);
      redis.exists.mockResolvedValue(1);
      safety.getBlockedIds.mockResolvedValue(new Set(['blockedMember']));
      prisma.user.findMany.mockResolvedValue([makeProfile('member1')]);
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([]);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.encounter.createMany.mockResolvedValue({ count: 1 });

      const result = await service.nearby('caller1');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { in: ['member1'] } }) }),
      );
      expect(result.storeId).toBe('store1');
      expect(result.players.map((p) => p.id)).toEqual(['member1']);
    });

    it('excludes users who opted out of discoverability', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['member1']);
      prisma.user.findMany.mockResolvedValue([makeProfile('member1', { privacySettings: { discoverable: false } })]);
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([]);
      prisma.event.findMany.mockResolvedValue([]);

      const result = await service.nearby('caller1');
      expect(result.players).toEqual([]);
    });

    it('marks metBefore true for peers with a prior encounter or connection', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['metPeer', 'connectedPeer', 'newPeer']);
      prisma.user.findMany.mockResolvedValue([
        makeProfile('metPeer'),
        makeProfile('connectedPeer'),
        makeProfile('newPeer'),
      ]);
      prisma.encounter.findMany.mockResolvedValue([
        { userId: 'caller1', opponentId: 'metPeer', store: { name: 'Old Store' }, createdAt: new Date() },
      ]);
      prisma.connection.findMany.mockResolvedValue([
        { requesterId: 'caller1', addresseeId: 'connectedPeer' },
      ]);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.encounter.createMany.mockResolvedValue({ count: 3 });

      const result = await service.nearby('caller1');
      const byId = new Map(result.players.map((p) => [p.id, p]));
      expect(byId.get('metPeer')?.metBefore).toBe(true);
      expect(byId.get('metPeer')?.lastMetStoreName).toBe('Old Store');
      expect(byId.get('connectedPeer')?.metBefore).toBe(true);
      expect(byId.get('newPeer')?.metBefore).toBe(false);
    });

    it('applies format/color/power/vibe filters', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['modernPlayer', 'commanderPlayer']);
      prisma.user.findMany.mockResolvedValue([
        makeProfile('modernPlayer', { formats: ['modern'], avatarColors: ['R'], powerLevel: 6, vibes: ['spike'] }),
        makeProfile('commanderPlayer', {
          formats: ['commander'],
          avatarColors: ['G'],
          powerLevel: 9,
          vibes: ['casual'],
        }),
      ]);
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([]);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.encounter.createMany.mockResolvedValue({ count: 2 });

      const result = await service.nearby('caller1', { format: 'modern' });
      expect(result.players.map((p) => p.id)).toEqual(['modernPlayer']);
    });

    it('does not write PRESENCE encounters when the caller has no store presence', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        lastLat: 40.0,
        lastLng: -73.0,
        lastLocatedAt: new Date(),
      });
      prisma.$queryRaw.mockResolvedValue([{ id: 'nearbyUser' }]);
      prisma.user.findMany.mockResolvedValue([makeProfile('nearbyUser')]);
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([]);

      const result = await service.nearby('caller1');

      expect(result.storeId).toBeNull();
      expect(prisma.encounter.createMany).not.toHaveBeenCalled();
      expect(result.players.map((p) => p.id)).toEqual(['nearbyUser']);
    });

    it('skips writing a PRESENCE encounter for a peer already logged today', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['member1']);
      prisma.user.findMany.mockResolvedValue([makeProfile('member1')]);
      prisma.encounter.findMany
        .mockResolvedValueOnce([]) // metBefore lookup
        .mockResolvedValueOnce([{ userId: 'caller1', opponentId: 'member1' }]); // alreadyToday
      prisma.connection.findMany.mockResolvedValue([]);
      prisma.event.findMany.mockResolvedValue([]);

      await service.nearby('caller1');

      expect(prisma.encounter.createMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // suggestions()
  // ---------------------------------------------------------------------------

  describe('suggestions', () => {
    it('returns no suggestions when the caller has no store presence', async () => {
      const result = await service.suggestions('caller1');
      expect(result).toEqual({ storeId: null, storeName: null, suggestions: [] });
    });

    it('returns no suggestions when nobody else is present', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue([]); // no other members

      const result = await service.suggestions('caller1');
      expect(result).toEqual({ storeId: 'store1', storeName: 'Store 1', suggestions: [] });
    });

    it('returns no suggestions once blocked peers are removed', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['blockedPeer']);
      safety.getBlockedIds.mockResolvedValue(new Set(['blockedPeer']));

      const result = await service.suggestions('caller1');
      expect(result.suggestions).toEqual([]);
    });

    it('returns no suggestions when the caller profile is missing', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['peer1']);
      prisma.user.findUnique.mockResolvedValueOnce(null); // callerUser lookup
      prisma.user.findMany.mockResolvedValue([makeProfile('peer1')]);
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([]);

      const result = await service.suggestions('caller1');
      expect(result.suggestions).toEqual([]);
    });

    it('excludes peers already connected to the caller', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['connectedPeer']);
      prisma.user.findUnique.mockResolvedValueOnce(makeProfile('caller1', { formats: ['commander'] }));
      prisma.user.findMany.mockResolvedValue([makeProfile('connectedPeer')]);
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([
        { requesterId: 'caller1', addresseeId: 'connectedPeer' },
      ]);

      const result = await service.suggestions('caller1');
      expect(result.suggestions).toEqual([]);
    });

    it('excludes peers who opted out of discoverability', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['privatePeer']);
      prisma.user.findUnique.mockResolvedValueOnce(makeProfile('caller1'));
      prisma.user.findMany.mockResolvedValue([
        makeProfile('privatePeer', { privacySettings: { discoverable: false } }),
      ]);
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([]);

      const result = await service.suggestions('caller1');
      expect(result.suggestions).toEqual([]);
    });

    it('scores shared format, exact power level, color overlap, positive encounters, and compatible vibes', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['greatMatch']);
      prisma.user.findUnique.mockResolvedValueOnce(
        makeProfile('caller1', {
          formats: ['commander'],
          powerLevel: 7,
          avatarColors: ['R', 'G'],
          vibes: ['casual'],
        }),
      );
      prisma.user.findMany.mockResolvedValue([
        makeProfile('greatMatch', {
          formats: ['commander'],
          powerLevel: 7,
          avatarColors: ['R'],
          vibes: ['timmy'],
        }),
      ]);
      prisma.encounter.findMany.mockResolvedValue([
        {
          userId: 'caller1',
          opponentId: 'greatMatch',
          source: 'GAME',
          result: 'WIN',
          store: { name: 'Store 1' },
          createdAt: new Date(),
        },
      ]);
      prisma.connection.findMany.mockResolvedValue([]);

      const result = await service.suggestions('caller1');

      expect(result.suggestions).toHaveLength(1);
      const suggestion = result.suggestions[0];
      // sharedFormat(30) + powerLevelExact(25) + colorOverlapPerColor(8) + positiveEncounterBonus(15) + vibeCompatible(20)
      expect(suggestion.score).toBe(30 + 25 + 8 * 1 + 15 + 20);
      expect(suggestion.reasons.map((r: { type: string }) => r.type)).toEqual(
        expect.arrayContaining(['shared_format', 'similar_power', 'color_overlap', 'positive_encounter', 'compatible_vibe']),
      );
    });

    it('falls back to a "new_connection" reason when nothing else scores', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      redis.zrange.mockResolvedValue(['stranger']);
      prisma.user.findUnique.mockResolvedValueOnce(makeProfile('caller1', { formats: [] }));
      prisma.user.findMany.mockResolvedValue([makeProfile('stranger', { formats: [] })]);
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([]);

      const result = await service.suggestions('caller1');
      expect(result.suggestions[0].score).toBe(0);
      expect(result.suggestions[0].reasons).toEqual([{ type: 'new_connection', label: 'New player to meet' }]);
    });

    it('sorts by score descending and caps the list at 5', async () => {
      redis.get.mockResolvedValue('store1');
      prisma.store.findUnique.mockResolvedValue({ name: 'Store 1' });
      const peerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      redis.zrange.mockResolvedValue(peerIds);
      prisma.user.findUnique.mockResolvedValueOnce(
        makeProfile('caller1', { formats: ['commander'] }),
      );
      // p1 has a shared format (higher score), the rest don't
      prisma.user.findMany.mockResolvedValue(
        peerIds.map((id) =>
          makeProfile(id, { formats: id === 'p1' ? ['commander'] : [] }),
        ),
      );
      prisma.encounter.findMany.mockResolvedValue([]);
      prisma.connection.findMany.mockResolvedValue([]);

      const result = await service.suggestions('caller1');
      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions[0].id).toBe('p1');
    });
  });
});
