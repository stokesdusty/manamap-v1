import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AssociateCheckinEventBody,
  CheckinBody,
  ConfirmStore,
  SuggestStore,
} from '@manamap/shared';
import type { PinoLogger } from 'nestjs-pino';
import { InjectPinoLogger } from 'nestjs-pino';
import { ModerationStatus, NotificationKind, Prisma, StoreStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { GamificationService } from '../gamification/gamification.service';
import { EventRemindersService } from '../event-reminders/event-reminders.service';
import { SafetyService } from '../safety/safety.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuestsService } from '../quests/quests.service';

const DEFAULT_CHECKIN_RADIUS_M = 1000;
const ACCURACY_CAP_M = 150;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Raw row returned by the PostGIS bbox query
type StorePinRow = {
  id: string;
  name: string;
  status: string;
  lat: number | null;
  lng: number | null;
  confirmation_count: number;
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
  private static readonly PROFILE_SELECT = {
    id: true,
    displayName: true,
    pronouns: true,
    bio: true,
    avatarColors: true,
    commander: true,
    powerLevel: true,
    vibes: true,
    formats: true,
  } as const;

  constructor(
    @InjectPinoLogger(StoresService.name) private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly gamification: GamificationService,
    private readonly eventReminders: EventRemindersService,
    private readonly safety: SafetyService,
    private readonly quests: QuestsService,
    private readonly notifications: NotificationsService,
  ) {}

  // -------------------------------------------------------------------------
  // Store list / search
  // -------------------------------------------------------------------------

  async list(opts: { bbox: string | undefined; q: string | undefined; includeProposed?: boolean }) {
    const { bbox, q, includeProposed = false } = opts;

    if (bbox) {
      // Parse "minLng,minLat,maxLng,maxLat"
      const parts = bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) {
        return [];
      }
      const [minLng, minLat, maxLng, maxLat] = parts;

      const statusFilter = includeProposed
        ? Prisma.sql`AND status != 'REJECTED'::"StoreStatus"`
        : Prisma.sql`AND status = 'ACTIVE'::"StoreStatus"`;

      // PostGIS intersection query — stores with no geom are naturally excluded
      const rows = await this.prisma.$queryRaw<StorePinRow[]>`
        SELECT
          s.id,
          s.name,
          s.status::text AS status,
          ST_Y(s.geom::geometry) AS lat,
          ST_X(s.geom::geometry) AS lng,
          COUNT(sc.id)::int AS confirmation_count
        FROM stores s
        LEFT JOIN store_confirmations sc ON sc.store_id = s.id
        WHERE s.geom IS NOT NULL
          ${statusFilter}
          AND ST_Intersects(
            s.geom,
            ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography
          )
        GROUP BY s.id
        LIMIT 200
      `;

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
        proposed: r.status === 'PROPOSED',
        confirmationCount: Number(r.confirmation_count),
      }));
    }

    // Text search fallback (no PostGIS needed)
    const statusWhere = includeProposed
      ? { status: { not: StoreStatus.REJECTED } }
      : { status: StoreStatus.ACTIVE };

    const baseQuery = {
      select: { id: true, name: true, city: true, state: true, status: true },
      take: 50,
      orderBy: { name: 'asc' },
    } as const;

    const stores = await this.prisma.store.findMany({
      ...baseQuery,
      where: q
        ? {
            ...statusWhere,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
              { state: { contains: q, mode: 'insensitive' } },
            ],
          }
        : statusWhere,
    });

    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      state: s.state,
      proposed: s.status === StoreStatus.PROPOSED,
    }));
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
      status: string;
      has_geom: boolean;
      within: boolean | null;
      distance_m: number | null;
      allowed_m: number;
    };
    const rows = await this.prisma.$queryRaw<StoreProxRow[]>`
      SELECT
        id,
        name,
        status::text AS status,
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

    if (store.status !== 'ACTIVE') {
      throw new NotFoundException('Store not found');
    }

    if (!store.has_geom) {
      this.logger.warn({ storeId }, 'Store has no geom — skipping proximity check');
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

    const [presence, gamificationResult, priorVisits, eligibleOffers, activeEvents] =
      await Promise.all([
        this.presence.heartbeat(userId, { storeId }),
        this.gamification.processCheckin(userId, storeId),
        this.prisma.checkin.count({ where: { userId, storeId, id: { not: checkin.id } } }),
        this.getEligibleOffers(userId, storeId),
        this.getActiveEventsNow(storeId),
      ]);

    void this.quests.evaluate(userId);

    return {
      checkinId: checkin.id,
      storeId: store.id,
      storeName: store.name,
      checkedInAt: checkin.checkedInAt.toISOString(),
      presenceExpiresIn: presence.expiresIn,
      newBadges: gamificationResult.newBadges,
      streak: gamificationResult.streak,
      eligibleOffers: eligibleOffers
        .filter((o) => {
          if (o.type === 'FIRST_VISIT') return priorVisits === 0;
          if (o.type === 'STREAK')
            return (gamificationResult.streak?.currentStreak ?? 0) >= (o.streakRequired ?? 2);
          return false;
        })
        .map((o) => ({
          id: o.id,
          type: o.type,
          title: o.title,
          description: o.description,
          terms: o.terms,
          redemptionCode: o.redemptionCode,
        })),
      activeEvents,
    };
  }

  private async getActiveEventsNow(storeId: string) {
    const now = new Date();
    // Include events starting within the next 15 minutes (early arrivals)
    const windowOpen = new Date(now.getTime() + 15 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: { storeId, startsAt: { lte: windowOpen } },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        format: { select: { name: true } },
      },
    });

    return events
      .filter((e) => {
        const effectiveEnd = e.endsAt ?? new Date(e.startsAt.getTime() + 4 * 60 * 60 * 1000);
        return effectiveEnd >= now;
      })
      .map((e) => ({
        id: e.id,
        name: e.name,
        startsAt: e.startsAt.toISOString(),
        formatName: e.format?.name ?? null,
      }));
  }

  async associateCheckinEvent(
    userId: string,
    storeId: string,
    checkinId: string,
    body: AssociateCheckinEventBody,
  ) {
    const [checkin, event] = await Promise.all([
      this.prisma.checkin.findFirst({
        where: { id: checkinId, userId, storeId, checkedOutAt: null },
      }),
      this.prisma.event.findFirst({
        where: { id: body.eventId, storeId },
        select: { id: true, name: true, startsAt: true, endsAt: true },
      }),
    ]);

    if (!checkin) throw new NotFoundException('Active check-in not found');
    if (!event) throw new NotFoundException('Event not found at this store');

    const now = new Date();
    const windowOpen = new Date(now.getTime() + 15 * 60 * 1000);
    const effectiveEnd = event.endsAt ?? new Date(event.startsAt.getTime() + 4 * 60 * 60 * 1000);
    if (event.startsAt > windowOpen || effectiveEnd < now) {
      throw new BadRequestException('Event is not currently active');
    }

    await Promise.all([
      this.prisma.checkin.update({ where: { id: checkinId }, data: { eventId: event.id } }),
      this.prisma.eventAttendee.upsert({
        where: { userId_eventId: { userId, eventId: event.id } },
        create: { userId, eventId: event.id },
        update: {},
      }),
    ]);

    return { checkinId, eventId: event.id, eventName: event.name };
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
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        terms: true,
        streakRequired: true,
        startsAt: true,
        endsAt: true,
      },
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
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        terms: true,
        redemptionCode: true,
        streakRequired: true,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  async getEvents(userId: string, storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    const windowStart = new Date(Date.now() - 60 * 60 * 1000); // include events started in past hour

    const [events, userAttendances, storeMembers] = await Promise.all([
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
      this.presence.getStoreMembers(storeId),
    ]);

    const attendingSet = new Set(userAttendances.map((a) => a.eventId));
    const memberSet = new Set(storeMembers);

    // For each event, count how many store members are attending
    const hereNowByEvent = new Map<string, number>();
    if (memberSet.size > 0) {
      const eventIds = events.map((e) => e.id);
      const memberAttendances = await this.prisma.eventAttendee.findMany({
        where: { eventId: { in: eventIds }, userId: { in: storeMembers } },
        select: { eventId: true },
      });
      for (const a of memberAttendances) {
        hereNowByEvent.set(a.eventId, (hereNowByEvent.get(a.eventId) ?? 0) + 1);
      }
      // Also count check-ins tagged with these events (may not have RSVPd)
      const taggedCheckins = await this.prisma.checkin.findMany({
        where: { eventId: { in: eventIds }, userId: { in: storeMembers }, checkedOutAt: null },
        select: { eventId: true, userId: true },
      });
      const taggedByEvent = new Map<string, Set<string>>();
      for (const c of taggedCheckins) {
        if (!c.eventId) continue;
        if (!taggedByEvent.has(c.eventId)) taggedByEvent.set(c.eventId, new Set());
        taggedByEvent.get(c.eventId)!.add(c.userId);
      }
      // Merge tagged-only (not already counted via RSVP) into hereNowByEvent
      const rsvpdByEvent = new Map<string, Set<string>>();
      for (const a of memberAttendances) {
        if (!rsvpdByEvent.has(a.eventId)) rsvpdByEvent.set(a.eventId, new Set());
      }
      for (const [eid, userIds] of taggedByEvent) {
        const alreadyCounted = rsvpdByEvent.get(eid) ?? new Set<string>();
        for (const uid of userIds) {
          if (!alreadyCounted.has(uid)) {
            hereNowByEvent.set(eid, (hereNowByEvent.get(eid) ?? 0) + 1);
          }
        }
      }
    }

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
        hereNowCount: hereNowByEvent.get(e.id) ?? 0,
      })),
    }));
  }

  async getEventAttendance(callerId: string, storeId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, storeId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const [storeMembers, attendees, blockedIds] = await Promise.all([
      this.presence.getStoreMembers(storeId),
      this.prisma.eventAttendee.findMany({
        where: { eventId },
        select: { userId: true },
      }),
      this.safety.getBlockedIds(callerId),
    ]);

    const memberSet = new Set(storeMembers);
    const attendeeIds = attendees.map((a) => a.userId);

    // Users tagged via check-in but not necessarily RSVP'd
    const taggedCheckins = await this.prisma.checkin.findMany({
      where: { eventId, storeId, checkedOutAt: null },
      select: { userId: true },
    });
    const taggedIds = taggedCheckins.map((c) => c.userId);

    // HERE NOW: in store presence AND (RSVP'd OR tagged via check-in)
    const rsvpdSet = new Set(attendeeIds);
    const taggedSet = new Set(taggedIds);
    const hereNowIds = new Set<string>();
    for (const id of memberSet) {
      if (rsvpdSet.has(id) || taggedSet.has(id)) hereNowIds.add(id);
    }

    // RSVP'd but not here now
    const rsvpdOnlyIds = attendeeIds.filter((id) => !hereNowIds.has(id));

    // All user IDs we need profiles for, minus blocked/self
    const allIds = [...new Set([...hereNowIds, ...rsvpdOnlyIds])].filter(
      (id) => id !== callerId && !blockedIds.has(id),
    );

    if (!allIds.length) {
      return { hereNow: [], rsvpd: [], hereNowCount: 0 };
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: allIds },
        moderationStatus: ModerationStatus.ACTIVE,
      },
      select: {
        ...StoresService.PROFILE_SELECT,
        privacySettings: { select: { discoverable: true } },
      },
    });

    const visibleUsers = users.filter((u) => u.privacySettings?.discoverable !== false);

    const toEntry = (u: (typeof visibleUsers)[number]) => ({
      id: u.id,
      displayName: u.displayName,
      pronouns: u.pronouns ?? null,
      bio: u.bio ?? null,
      avatarColors: u.avatarColors,
      commander: u.commander ?? null,
      powerLevel: u.powerLevel ?? null,
      vibes: u.vibes ?? [],
      formats: u.formats,
      isHereNow: hereNowIds.has(u.id),
    });

    const hereNow = visibleUsers.filter((u) => hereNowIds.has(u.id)).map(toEntry);
    const rsvpd = visibleUsers.filter((u) => !hereNowIds.has(u.id)).map(toEntry);

    return { hereNow, rsvpd, hereNowCount: hereNow.length };
  }

  async attendEvent(userId: string, storeId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, storeId },
      select: {
        id: true,
        name: true,
        startsAt: true,
        store: { select: { id: true, name: true, timezone: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    await this.prisma.eventAttendee.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId },
      update: {},
    });

    // Schedule reminders; jobId idempotency prevents duplicates on re-RSVP
    await this.eventReminders.scheduleReminders(userId, {
      eventId: event.id,
      eventName: event.name,
      startsAt: event.startsAt,
      storeId: event.store.id,
      storeName: event.store.name,
      timezone: event.store.timezone,
    });

    return { eventId: event.id, eventName: event.name };
  }

  async unattendEvent(userId: string, storeId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, storeId },
      select: { id: true, name: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    await this.prisma.eventAttendee.deleteMany({ where: { userId, eventId } });
    await this.eventReminders.cancelReminders(userId, eventId);

    return { eventId: event.id, eventName: event.name };
  }

  async notifyWhenActive(userId: string, storeId: string, threshold: number) {
    await this.presence.subscribeNotifyWhenActive(userId, storeId, threshold);
    return { storeId, threshold };
  }

  async getLeaderboard(callerId: string, storeId: string) {
    const [streakBoard, winsBoard] = await Promise.all([
      this.gamification.getLeaderboard(callerId, storeId),
      this.gamification.getWinsLeaderboard(callerId, storeId),
    ]);
    return {
      ...streakBoard,
      winsLeaderboard: winsBoard,
    };
  }

  // -------------------------------------------------------------------------
  // Store submissions
  // -------------------------------------------------------------------------

  async suggestStore(callerId: string, body: SuggestStore) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCount = await this.prisma.store.count({
      where: { submittedById: callerId, createdAt: { gte: sevenDaysAgo } },
    });
    if (recentCount >= 3) {
      throw new BadRequestException({ code: 'submission_limit_reached' });
    }

    let submitterProximity = false;
    if (body.submitterLat != null && body.submitterLng != null) {
      submitterProximity =
        haversineMeters(body.submitterLat, body.submitterLng, body.lat, body.lng) <= 500;
    }

    const store = await this.prisma.store.create({
      data: {
        name: body.name,
        address: body.address ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        website: body.website ?? null,
        status: StoreStatus.PROPOSED,
        submittedById: callerId,
        submitterNote: body.note ?? null,
      },
      select: { id: true, name: true },
    });

    await this.prisma.$executeRaw`
      UPDATE stores SET geom = ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)::geography
      WHERE id = ${store.id}
    `;

    await this.prisma.storeConfirmation.create({
      data: { storeId: store.id, userId: callerId, proximity: submitterProximity },
    });

    await this.checkAutoApprove(store.id);

    return { id: store.id, name: store.name, status: 'proposed' as const, alreadyConfirmed: true };
  }

  async confirmStore(callerId: string, storeId: string, body: ConfirmStore) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, status: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.status !== StoreStatus.PROPOSED) {
      throw new BadRequestException({ code: 'store_not_proposed' });
    }

    const existing = await this.prisma.storeConfirmation.findUnique({
      where: { storeId_userId: { storeId, userId: callerId } },
    });
    if (existing) {
      const confirmationCount = await this.prisma.storeConfirmation.count({ where: { storeId } });
      return { confirmationCount, status: store.status };
    }

    let proximity = false;
    if (body.lat != null && body.lng != null) {
      type ProxRow = { within: boolean };
      const rows = await this.prisma.$queryRaw<ProxRow[]>`
        SELECT ST_DWithin(geom, ST_SetSRID(ST_MakePoint(${body.lng}, ${body.lat}), 4326)::geography, 500) AS within
        FROM stores WHERE id = ${storeId} AND geom IS NOT NULL
      `;
      if (rows.length) proximity = Boolean(rows[0].within);
    }

    await this.prisma.storeConfirmation.create({
      data: { storeId, userId: callerId, proximity },
    });

    await this.checkAutoApprove(storeId);

    const [updatedStore, confirmationCount] = await Promise.all([
      this.prisma.store.findUnique({ where: { id: storeId }, select: { status: true } }),
      this.prisma.storeConfirmation.count({ where: { storeId } }),
    ]);

    return {
      confirmationCount,
      status: updatedStore?.status ?? StoreStatus.PROPOSED,
    };
  }

  async checkAutoApprove(storeId: string): Promise<void> {
    const [store, total, proximityCount] = await Promise.all([
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: { status: true, submittedById: true, name: true },
      }),
      this.prisma.storeConfirmation.count({ where: { storeId } }),
      this.prisma.storeConfirmation.count({ where: { storeId, proximity: true } }),
    ]);

    if (!store || store.status !== StoreStatus.PROPOSED) return;

    const shouldApprove = (total >= 3 && proximityCount >= 1) || total >= 5;
    if (!shouldApprove) return;

    await this.prisma.store.update({
      where: { id: storeId },
      data: { status: StoreStatus.ACTIVE },
    });

    if (store.submittedById) {
      await this.notifications.create(store.submittedById, {
        kind: NotificationKind.BROADCAST,
        title: 'Your store suggestion was approved!',
        body: `${store.name} is now live on the map.`,
        data: { type: 'store_approved', storeId },
      });
    }
  }
}
