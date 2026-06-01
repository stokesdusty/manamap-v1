import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CheckinBody } from '@manamap/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { GamificationService } from '../gamification/gamification.service';
import { StoreConnector } from './connectors/store.connector';
import { DiscordConnector } from './connectors/discord.connector';
import { WizardsConnector } from './connectors/wizards.connector';
import type { IEventConnector } from './connectors/event-connector.interface';

const DEFAULT_CHECKIN_RADIUS_M = 250;
const ACCURACY_CAP_M = 150;

// Raw row returned by the PostGIS bbox query
type StorePinRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

type StoreDetailRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  discordUrl: string | null;
  lat: number | null;
  lng: number | null;
};

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);
  private readonly connectors: IEventConnector[] = [
    new StoreConnector(),
    new DiscordConnector(),
    new WizardsConnector(),
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly gamification: GamificationService,
  ) {}

  // -------------------------------------------------------------------------
  // Store list / search
  // -------------------------------------------------------------------------

  async list(opts: { bbox: string | undefined; q: string | undefined }) {
    const { bbox, q } = opts;

    if (bbox) {
      // Parse "minLng,minLat,maxLng,maxLat"
      const parts = bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) {
        return [];
      }
      const [minLng, minLat, maxLng, maxLat] = parts;

      // PostGIS intersection query — stores with no geom are naturally excluded
      const rows = await this.prisma.$queryRaw<StorePinRow[]>`
        SELECT
          id,
          name,
          ST_Y(geom::geometry) AS lat,
          ST_X(geom::geometry) AS lng
        FROM stores
        WHERE geom IS NOT NULL
          AND ST_Intersects(
            geom,
            ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography
          )
        LIMIT 200
      `;

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
      }));
    }

    // Text search fallback (no PostGIS needed)
    const common = {
      select: { id: true, name: true, city: true, state: true },
      take: 50,
      orderBy: { name: 'asc' },
    } as const;

    if (q) {
      return this.prisma.store.findMany({
        ...common,
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
            { state: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
    }

    return this.prisma.store.findMany(common);
  }

  // -------------------------------------------------------------------------
  // Store detail
  // -------------------------------------------------------------------------

  async getDetail(storeId: string) {
    const rows = await this.prisma.$queryRaw<StoreDetailRow[]>`
      SELECT
        id,
        name,
        address,
        city,
        state,
        zip,
        discord_url   AS "discordUrl",
        CASE WHEN geom IS NOT NULL THEN ST_Y(geom::geometry) ELSE NULL END AS lat,
        CASE WHEN geom IS NOT NULL THEN ST_X(geom::geometry) ELSE NULL END AS lng
      FROM stores
      WHERE id = ${storeId}
    `;

    if (!rows.length) throw new NotFoundException('Store not found');

    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city,
      state: r.state,
      zip: r.zip,
      discordUrl: r.discordUrl,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
    };
  }

  // -------------------------------------------------------------------------
  // Check-in
  // -------------------------------------------------------------------------

  async checkin(userId: string, storeId: string, body: CheckinBody) {
    // Single raw query: fetch store + compute proximity in one round-trip.
    // Using COALESCE so per-store radius overrides the global default,
    // and LEAST caps device accuracy to ACCURACY_CAP_M.
    const cappedAccuracy = Math.min(body.accuracy ?? 0, ACCURACY_CAP_M);
    type StoreProxRow = {
      id: string;
      name: string;
      has_geom: boolean;
      within: boolean | null;
      distance_m: number | null;
      allowed_m: number;
    };
    const rows = await this.prisma.$queryRaw<StoreProxRow[]>`
      SELECT
        id,
        name,
        geom IS NOT NULL AS has_geom,
        CASE WHEN geom IS NOT NULL
          THEN ST_DWithin(
            geom,
            ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)::geography,
            COALESCE(checkin_radius_meters, ${DEFAULT_CHECKIN_RADIUS_M}) + ${cappedAccuracy}
          )
          ELSE NULL
        END AS within,
        CASE WHEN geom IS NOT NULL
          THEN ST_Distance(geom, ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)::geography)
          ELSE NULL
        END AS distance_m,
        COALESCE(checkin_radius_meters, ${DEFAULT_CHECKIN_RADIUS_M}) + ${cappedAccuracy} AS allowed_m
      FROM stores
      WHERE id = ${storeId}
    `;

    if (!rows.length) throw new NotFoundException('Store not found');
    const store = rows[0];

    if (!store.has_geom) {
      this.logger.warn(`Store ${storeId} has no geom — skipping proximity check`);
    } else if (store.within === false) {
      const distanceMeters = Math.round(Number(store.distance_m ?? 0));
      throw new HttpException(
        { code: 'too_far', distanceMeters, allowedMeters: Math.round(Number(store.allowed_m)) },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.prisma.checkin.updateMany({
      where: { userId, checkedOutAt: null, storeId: { not: storeId } },
      data: { checkedOutAt: new Date() },
    });

    const checkin = await this.prisma.checkin.create({
      data: { userId, storeId },
    });

    const [presence, gamificationResult, priorVisits, eligibleOffers] = await Promise.all([
      this.presence.heartbeat(userId, storeId),
      this.gamification.processCheckin(userId, storeId),
      this.prisma.checkin.count({ where: { userId, storeId, id: { not: checkin.id } } }),
      this.getEligibleOffers(userId, storeId),
    ]);

    return {
      checkinId: checkin.id,
      storeId: store.id,
      storeName: store.name,
      checkedInAt: checkin.checkedInAt.toISOString(),
      presenceExpiresIn: presence.expiresIn,
      newBadges: gamificationResult.newBadges,
      streak: gamificationResult.streak,
      eligibleOffers: eligibleOffers.filter((o) => {
        if (o.type === 'FIRST_VISIT') return priorVisits === 0;
        if (o.type === 'STREAK') return (gamificationResult.streak?.currentStreak ?? 0) >= (o.streakRequired ?? 2);
        return false;
      }).map((o) => ({
        id: o.id,
        type: o.type,
        title: o.title,
        description: o.description,
        terms: o.terms,
        redemptionCode: o.redemptionCode,
      })),
    };
  }

  async getActiveOffers(storeId: string) {
    const now = new Date();
    return this.prisma.rewardOffer.findMany({
      where: {
        storeId,
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      select: { id: true, type: true, title: true, description: true, terms: true, streakRequired: true, startsAt: true, endsAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async getEligibleOffers(_userId: string, storeId: string) {
    const now = new Date();
    return this.prisma.rewardOffer.findMany({
      where: {
        storeId,
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      select: { id: true, type: true, title: true, description: true, terms: true, redemptionCode: true, streakRequired: true },
    });
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  async getEvents(userId: string, storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
    if (!store) throw new NotFoundException('Store not found');

    const windowStart = new Date(Date.now() - 60 * 60 * 1000); // include events started in past hour

    const [events, userAttendances] = await Promise.all([
      this.prisma.event.findMany({
        where: { storeId, startsAt: { gte: windowStart } },
        select: {
          id: true,
          name: true,
          source: true,
          description: true,
          url: true,
          eventChannelUrl: true,
          startsAt: true,
          endsAt: true,
          format: { select: { name: true, slug: true } },
          _count: { select: { attendees: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 50,
      }),
      this.prisma.eventAttendee.findMany({
        where: { userId },
        select: { eventId: true },
      }),
    ]);

    const attendingSet = new Set(userAttendances.map((a) => a.eventId));

    // Group by calendar date (UTC date string)
    const byDay = new Map<string, typeof events>();
    for (const evt of events) {
      const day = evt.startsAt.toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(evt);
    }

    return Array.from(byDay.entries()).map(([date, evts]) => ({
      date,
      events: evts.map((e) => ({
        id: e.id,
        name: e.name,
        source: e.source,
        description: e.description ?? null,
        url: e.url ?? null,
        eventChannelUrl: e.eventChannelUrl ?? null,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt?.toISOString() ?? null,
        formatName: e.format?.name ?? null,
        formatSlug: e.format?.slug ?? null,
        attendeeCount: e._count.attendees,
        isAttending: attendingSet.has(e.id),
      })),
    }));
  }

  async attendEvent(userId: string, storeId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, storeId },
      select: { id: true, name: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    await this.prisma.eventAttendee.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId },
      update: {},
    });

    return { eventId: event.id, eventName: event.name };
  }

  getLeaderboard(callerId: string, storeId: string) {
    return this.gamification.getLeaderboard(callerId, storeId);
  }

  getConnectors() {
    return this.connectors;
  }
}
