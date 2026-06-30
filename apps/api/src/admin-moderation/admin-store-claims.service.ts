import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { NotificationKind, StoreClaimStatus, UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminStoreClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listPending() {
    const claims = await this.prisma.storeClaim.findMany({
      where: { status: StoreClaimStatus.PENDING },
      select: {
        id: true,
        storeId: true,
        userId: true,
        note: true,
        createdAt: true,
        store: { select: { name: true } },
        user: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return claims.map((c) => ({
      id: c.id,
      storeId: c.storeId,
      storeName: c.store.name,
      userId: c.userId,
      claimantName: c.user.displayName,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async approve(claimId: string, adminId: string) {
    const claim = await this.prisma.storeClaim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        storeId: true,
        userId: true,
        status: true,
        store: { select: { name: true } },
      },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== StoreClaimStatus.PENDING) {
      throw new BadRequestException({ code: 'claim_not_pending' });
    }

    const existingOwner = await this.prisma.storeOwnership.findFirst({
      where: { storeId: claim.storeId },
      select: { id: true },
    });
    if (existingOwner) throw new ConflictException({ code: 'already_claimed' });

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.storeClaim.update({
        where: { id: claimId },
        data: { status: StoreClaimStatus.APPROVED, reviewedById: adminId, reviewedAt: now },
      }),
      this.prisma.storeOwnership.upsert({
        where: { userId_storeId: { userId: claim.userId, storeId: claim.storeId } },
        create: {
          id: randomBytes(16).toString('hex'),
          userId: claim.userId,
          storeId: claim.storeId,
        },
        update: {},
      }),
      this.prisma.user.update({
        where: { id: claim.userId },
        data: { role: { set: UserRole.PARTNER } },
      }),
    ]);

    const others = await this.prisma.storeClaim.findMany({
      where: { storeId: claim.storeId, status: StoreClaimStatus.PENDING, id: { not: claimId } },
      select: { id: true, userId: true },
    });
    if (others.length) {
      await this.prisma.storeClaim.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: {
          status: StoreClaimStatus.REJECTED,
          rejectionReason: 'store_already_claimed',
          reviewedById: adminId,
          reviewedAt: now,
        },
      });
      await Promise.all(
        others.map((o) =>
          this.notifications.create(o.userId, {
            kind: NotificationKind.BROADCAST,
            title: 'Store claim update',
            body: `${claim.store.name} was claimed by another user.`,
            data: { type: 'store_claim_rejected', storeId: claim.storeId },
          }),
        ),
      );
    }

    await this.notifications.create(claim.userId, {
      kind: NotificationKind.BROADCAST,
      title: 'Your store claim was approved!',
      body: `You're now a partner for ${claim.store.name}.`,
      data: { type: 'store_claim_approved', storeId: claim.storeId },
    });

    return { id: claimId, status: 'APPROVED' };
  }

  async reject(claimId: string, adminId: string, reason?: string) {
    const claim = await this.prisma.storeClaim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        storeId: true,
        status: true,
        userId: true,
        store: { select: { name: true } },
      },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== StoreClaimStatus.PENDING) {
      return { id: claimId, status: claim.status };
    }

    await this.prisma.storeClaim.update({
      where: { id: claimId },
      data: {
        status: StoreClaimStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        ...(reason !== undefined ? { rejectionReason: reason } : {}),
      },
    });

    await this.notifications.create(claim.userId, {
      kind: NotificationKind.BROADCAST,
      title: 'Your store claim was not approved',
      body: reason
        ? `${claim.store.name}: ${reason}`
        : `Your claim for ${claim.store.name} was not approved.`,
      data: { type: 'store_claim_rejected', storeId: claim.storeId },
    });

    return { id: claimId, status: 'REJECTED' };
  }
}
