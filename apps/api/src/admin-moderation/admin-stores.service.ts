import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma, StoreStatus } from '@prisma/client';
import type { UpdateStoreProfile } from '@manamap/shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { generateCode } from '../common/codes';

@Injectable()
export class AdminStoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listSubmissions() {
    type Row = {
      id: string;
      name: string;
      address: string | null;
      city: string | null;
      state: string | null;
      website: string | null;
      submitter_note: string | null;
      created_at: Date;
      submitter_display_name: string | null;
      confirmation_count: number;
      proximity_count: number;
      lat: number | null;
      lng: number | null;
    };

    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        s.id,
        s.name,
        s.address,
        s.city,
        s.state,
        s.website,
        s.submitter_note,
        s.created_at,
        u.display_name AS submitter_display_name,
        COUNT(sc.id)::int AS confirmation_count,
        COUNT(sc.id) FILTER (WHERE sc.proximity = true)::int AS proximity_count,
        CASE WHEN s.geom IS NOT NULL THEN ST_Y(s.geom::geometry) ELSE NULL END AS lat,
        CASE WHEN s.geom IS NOT NULL THEN ST_X(s.geom::geometry) ELSE NULL END AS lng
      FROM stores s
      LEFT JOIN users u ON u.id = s.submitted_by_id
      LEFT JOIN store_confirmations sc ON sc.store_id = s.id
      WHERE s.status = 'PROPOSED'::"StoreStatus"
      GROUP BY s.id, u.display_name
      ORDER BY confirmation_count DESC, s.created_at ASC
    `);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city,
      state: r.state,
      website: r.website,
      submitterNote: r.submitter_note,
      submittedAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      submittedBy: { displayName: r.submitter_display_name ?? 'Unknown' },
      confirmationCount: Number(r.confirmation_count),
      proximityConfirmationCount: Number(r.proximity_count),
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
    }));
  }

  async approveStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { status: true, submittedById: true, name: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.status !== StoreStatus.PROPOSED) {
      throw new BadRequestException({ code: 'store_not_proposed' });
    }

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

    return { id: storeId, status: 'ACTIVE' };
  }

  async rejectStore(storeId: string, reason?: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { status: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.status === StoreStatus.REJECTED) return { id: storeId, status: 'REJECTED' };

    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        status: StoreStatus.REJECTED,
        ...(reason !== undefined ? { submitterNote: reason } : {}),
      },
    });

    return { id: storeId, status: 'REJECTED' };
  }

  async generateClaimCode(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    let code: string;
    for (;;) {
      code = generateCode();
      const existing = await this.prisma.store.findUnique({
        where: { claimCode: code },
        select: { id: true },
      });
      if (!existing) break;
    }

    await this.prisma.store.update({ where: { id: storeId }, data: { claimCode: code! } });

    return { storeId, claimCode: code! };
  }

  // ---------------------------------------------------------------------------
  // General store lookup & management (not tied to the submission queue)
  // ---------------------------------------------------------------------------

  async search(q: string | undefined) {
    const query = q?.trim();
    const stores = await this.prisma.store.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { city: { contains: query, mode: 'insensitive' } },
              { state: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {},
      take: 20,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        status: true,
        _count: { select: { ownerships: true } },
      },
    });

    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      state: s.state,
      status: s.status,
      ownerCount: s._count.ownerships,
    }));
  }

  async getDetail(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        website: true,
        discordUrl: true,
        status: true,
        ownerships: {
          select: { userId: true, user: { select: { displayName: true, email: true } } },
        },
      },
    });
    if (!store) throw new NotFoundException('Store not found');

    const [activeOffers, checkins, upcomingEvents] = await Promise.all([
      this.prisma.rewardOffer.count({ where: { storeId, active: true } }),
      this.prisma.checkin.count({ where: { storeId } }),
      this.prisma.event.count({ where: { storeId, startsAt: { gte: new Date() } } }),
    ]);

    return {
      id: store.id,
      name: store.name,
      address: store.address,
      city: store.city,
      state: store.state,
      zip: store.zip,
      website: store.website,
      discordUrl: store.discordUrl,
      status: store.status,
      owners: store.ownerships.map((o) => ({
        userId: o.userId,
        displayName: o.user.displayName,
        email: o.user.email,
      })),
      counts: { activeOffers, checkins, upcomingEvents },
    };
  }

  async updateProfile(storeId: string, dto: UpdateStoreProfile) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
    if (!store) throw new NotFoundException('Store not found');

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

  async reactivateStore(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
    if (!store) throw new NotFoundException('Store not found');

    await this.prisma.store.update({ where: { id: storeId }, data: { status: StoreStatus.ACTIVE } });
    return { id: storeId, status: 'ACTIVE' };
  }

  async removeOwner(storeId: string, userId: string) {
    await this.prisma.storeOwnership.deleteMany({ where: { storeId, userId } });
    return { success: true };
  }
}
