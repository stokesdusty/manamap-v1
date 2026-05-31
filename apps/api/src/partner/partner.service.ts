import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRewardOffer, UpdateRewardOffer, UpdateStoreProfile } from '@manamap/shared';

function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(8))
    .map((b) => chars[b % chars.length])
    .join('');
}

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Store ownership
  // ---------------------------------------------------------------------------

  async claimStore(userId: string, storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } });
    if (!store) throw new NotFoundException('Store not found');

    await this.prisma.$transaction([
      this.prisma.storeOwnership.upsert({
        where: { userId_storeId: { userId, storeId } },
        create: { id: randomBytes(16).toString('hex'), userId, storeId },
        update: {},
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: { set: 'PARTNER' } as any },
      }),
    ]);

    return { storeId: store.id, storeName: store.name };
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
      select: { id: true, name: true, address: true, city: true, state: true, zip: true, discordUrl: true },
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
      code = generateRedemptionCode();
      const existing = await this.prisma.rewardOffer.findUnique({ where: { redemptionCode: code }, select: { id: true } });
      if (!existing) break;
    }

    return this.prisma.rewardOffer.create({
      data: {
        storeId,
        type: dto.type as any,
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
    const offer = await this.prisma.rewardOffer.findFirst({ where: { id: offerId, storeId }, select: { id: true } });
    if (!offer) throw new NotFoundException('Offer not found');

    return this.prisma.rewardOffer.update({
      where: { id: offerId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type as any } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.terms !== undefined ? { terms: dto.terms } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.streakRequired !== undefined ? { streakRequired: dto.streakRequired } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
      },
    });
  }

  async deleteOffer(userId: string, storeId: string, offerId: string) {
    await this.assertOwner(userId, storeId);
    const offer = await this.prisma.rewardOffer.findFirst({ where: { id: offerId, storeId }, select: { id: true } });
    if (!offer) throw new NotFoundException('Offer not found');
    await this.prisma.rewardOffer.delete({ where: { id: offerId } });
  }

  // ---------------------------------------------------------------------------

  private async assertOwner(userId: string, storeId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role === 'ADMIN') return; // admins bypass ownership check
    const owns = await this.prisma.storeOwnership.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { id: true },
    });
    if (!owns) throw new ForbiddenException('You do not own this store');
  }
}
