import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma, StoreStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true } });
    if (!store) throw new NotFoundException('Store not found');

    let code: string;
    for (;;) {
      code = generateCode();
      const existing = await this.prisma.store.findUnique({ where: { claimCode: code }, select: { id: true } });
      if (!existing) break;
    }

    await this.prisma.store.update({ where: { id: storeId }, data: { claimCode: code! } });

    return { storeId, claimCode: code! };
  }
}
