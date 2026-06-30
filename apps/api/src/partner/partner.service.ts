import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EventSource, StoreClaimStatus, UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { EventRemindersService } from '../event-reminders/event-reminders.service';
import { generateCode } from '../common/codes';
import { EVENT_RECURRENCE_WEEKS } from '@manamap/shared';
import type {
  CreateEvent,
  CreateRewardOffer,
  UpdateEvent,
  UpdateRewardOffer,
  UpdateStoreProfile,
} from '@manamap/shared';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class PartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventReminders: EventRemindersService,
  ) {}

  // ---------------------------------------------------------------------------
  // Store ownership
  // ---------------------------------------------------------------------------

  async claimStore(userId: string, storeId: string, dto: { code?: string; note?: string }) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, claimCode: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    const existingOwner = await this.prisma.storeOwnership.findFirst({
      where: { storeId },
      select: { id: true },
    });
    if (existingOwner) {
      await this.prisma.storeClaim.create({
        data: {
          storeId,
          userId,
          status: StoreClaimStatus.REJECTED,
          rejectionReason: 'already_claimed',
        },
      });
      throw new ConflictException({ code: 'already_claimed' });
    }

    if (dto.code) {
      const codeMatches =
        !!store.claimCode && dto.code.trim().toUpperCase() === store.claimCode.toUpperCase();
      if (!codeMatches) {
        await this.prisma.storeClaim.create({
          data: {
            storeId,
            userId,
            status: StoreClaimStatus.REJECTED,
            rejectionReason: 'invalid_code',
          },
        });
        throw new BadRequestException({ code: 'invalid_claim_code' });
      }

      await this.prisma.$transaction([
        this.prisma.storeClaim.create({
          data: {
            storeId,
            userId,
            status: StoreClaimStatus.APPROVED,
            viaCode: true,
            reviewedAt: new Date(),
          },
        }),
        this.prisma.storeOwnership.upsert({
          where: { userId_storeId: { userId, storeId } },
          create: { id: randomBytes(16).toString('hex'), userId, storeId },
          update: {},
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { role: { set: UserRole.PARTNER } },
        }),
        this.prisma.store.update({ where: { id: storeId }, data: { claimCode: null } }),
      ]);

      return { status: 'APPROVED' as const, storeId: store.id, storeName: store.name };
    }

    const existingPending = await this.prisma.storeClaim.findFirst({
      where: { storeId, userId, status: StoreClaimStatus.PENDING },
      select: { id: true },
    });
    if (existingPending) throw new ConflictException({ code: 'claim_already_pending' });

    await this.prisma.storeClaim.create({
      data: { storeId, userId, status: StoreClaimStatus.PENDING, note: dto.note ?? null },
    });

    return { status: 'PENDING' as const, storeId: store.id, storeName: store.name };
  }

  async getMyStores(userId: string) {
    const ownerships = await this.prisma.storeOwnership.findMany({
      where: { userId },
      select: {
        storeId: true,
        createdAt: true,
        store: { select: { id: true, name: true, city: true, state: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return ownerships.map((o) => ({ ...o.store, claimedAt: o.createdAt.toISOString() }));
  }

  async updateStoreProfile(userId: string, storeId: string, dto: UpdateStoreProfile) {
    await this.assertOwner(userId, storeId);
    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.zip !== undefined ? { zip: dto.zip } : {}),
        ...(dto.discordUrl !== undefined ? { discordUrl: dto.discordUrl } : {}),
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        discordUrl: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------

  async getAnalytics(userId: string, storeId: string) {
    await this.assertOwner(userId, storeId);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

    const [total, weekly, monthly, uniqueVisitors, activeOffers] = await Promise.all([
      this.prisma.checkin.count({ where: { storeId } }),
      this.prisma.checkin.count({ where: { storeId, checkedInAt: { gte: weekAgo } } }),
      this.prisma.checkin.count({ where: { storeId, checkedInAt: { gte: monthAgo } } }),
      this.prisma.checkin.groupBy({ by: ['userId'], where: { storeId } }).then((r) => r.length),
      this.prisma.rewardOffer.count({ where: { storeId, active: true } }),
    ]);

    return {
      totalCheckins: total,
      checkinsThisWeek: weekly,
      checkinsThisMonth: monthly,
      uniqueVisitors,
      activeOffers,
    };
  }

  // ---------------------------------------------------------------------------
  // Offer CRUD
  // ---------------------------------------------------------------------------

  async listOffers(userId: string, storeId: string) {
    await this.assertOwner(userId, storeId);
    return this.prisma.rewardOffer.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOffer(userId: string, storeId: string, dto: CreateRewardOffer) {
    await this.assertOwner(userId, storeId);

    let code: string;
    for (;;) {
      code = generateCode();
      const existing = await this.prisma.rewardOffer.findUnique({
        where: { redemptionCode: code },
        select: { id: true },
      });
      if (!existing) break;
    }

    return this.prisma.rewardOffer.create({
      data: {
        storeId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        terms: dto.terms ?? null,
        redemptionCode: code!,
        streakRequired: dto.streakRequired ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }

  async updateOffer(userId: string, storeId: string, offerId: string, dto: UpdateRewardOffer) {
    await this.assertOwner(userId, storeId);
    const offer = await this.prisma.rewardOffer.findFirst({
      where: { id: offerId, storeId },
      select: { id: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    return this.prisma.rewardOffer.update({
      where: { id: offerId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.terms !== undefined ? { terms: dto.terms } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.streakRequired !== undefined ? { streakRequired: dto.streakRequired } : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
          : {}),
        ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
      },
    });
  }

  async deleteOffer(userId: string, storeId: string, offerId: string) {
    await this.assertOwner(userId, storeId);
    const offer = await this.prisma.rewardOffer.findFirst({
      where: { id: offerId, storeId },
      select: { id: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    await this.prisma.rewardOffer.delete({ where: { id: offerId } });
  }

  // ---------------------------------------------------------------------------
  // Formats
  // ---------------------------------------------------------------------------

  async listFormats() {
    return this.prisma.format.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Event CRUD
  // ---------------------------------------------------------------------------

  async listPartnerEvents(userId: string, storeId: string) {
    await this.assertOwner(userId, storeId);
    const events = await this.prisma.event.findMany({
      where: { storeId },
      select: {
        id: true,
        name: true,
        source: true,
        description: true,
        formatId: true,
        startsAt: true,
        endsAt: true,
        eventChannelUrl: true,
        createdAt: true,
        format: { select: { name: true } },
        _count: { select: { attendees: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      name: e.name,
      source: e.source,
      description: e.description ?? null,
      formatId: e.formatId ?? null,
      formatName: e.format?.name ?? null,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt?.toISOString() ?? null,
      eventChannelUrl: e.eventChannelUrl ?? null,
      attendeeCount: e._count.attendees,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async createPartnerEvent(userId: string, storeId: string, dto: CreateEvent) {
    await this.assertOwner(userId, storeId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

    const event = await this.prisma.event.create({
      data: {
        storeId,
        source: EventSource.STORE,
        name: dto.name,
        ...(dto.formatId !== undefined ? { formatId: dto.formatId } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        startsAt,
        ...(endsAt ? { endsAt } : {}),
        ...(dto.eventChannelUrl !== undefined ? { eventChannelUrl: dto.eventChannelUrl } : {}),
      },
      select: {
        id: true,
        name: true,
        source: true,
        description: true,
        formatId: true,
        startsAt: true,
        endsAt: true,
        eventChannelUrl: true,
        createdAt: true,
        format: { select: { name: true } },
      },
    });

    if (dto.repeatWeekly) {
      await this.prisma.event.createMany({
        data: Array.from({ length: EVENT_RECURRENCE_WEEKS - 1 }, (_, i) => ({
          storeId,
          source: EventSource.STORE,
          name: dto.name,
          formatId: dto.formatId ?? null,
          description: dto.description ?? null,
          startsAt: new Date(startsAt.getTime() + WEEK_MS * (i + 1)),
          endsAt: endsAt ? new Date(endsAt.getTime() + WEEK_MS * (i + 1)) : null,
          eventChannelUrl: dto.eventChannelUrl ?? null,
        })),
      });
    }

    return {
      id: event.id,
      name: event.name,
      source: event.source,
      description: event.description ?? null,
      formatId: event.formatId ?? null,
      formatName: event.format?.name ?? null,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      eventChannelUrl: event.eventChannelUrl ?? null,
      attendeeCount: 0,
      createdAt: event.createdAt.toISOString(),
    };
  }

  async updatePartnerEvent(userId: string, storeId: string, eventId: string, dto: UpdateEvent) {
    await this.assertOwner(userId, storeId);

    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, storeId },
      select: {
        id: true,
        source: true,
        name: true,
        startsAt: true,
        store: { select: { id: true, name: true, timezone: true } },
      },
    });
    if (!existing) throw new NotFoundException('Event not found');
    if (existing.source !== EventSource.STORE) throw new ForbiddenException('read_only_event');

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.formatId !== undefined ? { formatId: dto.formatId } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
        ...(dto.eventChannelUrl !== undefined ? { eventChannelUrl: dto.eventChannelUrl } : {}),
      },
      select: {
        id: true,
        name: true,
        source: true,
        description: true,
        formatId: true,
        startsAt: true,
        endsAt: true,
        eventChannelUrl: true,
        createdAt: true,
        format: { select: { name: true } },
        _count: { select: { attendees: true } },
      },
    });

    if (dto.startsAt && new Date(dto.startsAt).getTime() !== existing.startsAt.getTime()) {
      const attendees = await this.prisma.eventAttendee.findMany({
        where: { eventId },
        select: { userId: true },
      });
      await Promise.all(
        attendees.map(async (a) => {
          await this.eventReminders.cancelReminders(a.userId, eventId);
          await this.eventReminders.scheduleReminders(a.userId, {
            eventId,
            eventName: updated.name,
            startsAt: updated.startsAt,
            storeId: existing.store.id,
            storeName: existing.store.name,
            timezone: existing.store.timezone,
          });
        }),
      );
    }

    return {
      id: updated.id,
      name: updated.name,
      source: updated.source,
      description: updated.description ?? null,
      formatId: updated.formatId ?? null,
      formatName: updated.format?.name ?? null,
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt?.toISOString() ?? null,
      eventChannelUrl: updated.eventChannelUrl ?? null,
      attendeeCount: updated._count.attendees,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async deletePartnerEvent(userId: string, storeId: string, eventId: string) {
    await this.assertOwner(userId, storeId);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, storeId },
      select: { id: true, source: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.source !== EventSource.STORE) throw new ForbiddenException('read_only_event');

    await this.prisma.event.delete({ where: { id: eventId } });
  }

  // ---------------------------------------------------------------------------

  private async assertOwner(userId: string, storeId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'ADMIN') return; // admins bypass ownership check
    const owns = await this.prisma.storeOwnership.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { id: true },
    });
    if (!owns) throw new ForbiddenException('You do not own this store');
  }
}
