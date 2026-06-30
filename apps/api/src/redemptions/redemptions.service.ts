import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  return Array.from(randomBytes(8))
    .map((b) => CODE_CHARSET[b % CODE_CHARSET.length])
    .join('');
}

@Injectable()
export class RedemptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Player: claim a one-time code for an eligible offer
  // ---------------------------------------------------------------------------

  async claimOffer(userId: string, offerId: string) {
    const offer = await this.prisma.rewardOffer.findUnique({
      where: { id: offerId },
      select: {
        id: true,
        storeId: true,
        type: true,
        title: true,
        active: true,
        streakRequired: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    const now = new Date();
    if (!offer.active) throw new BadRequestException('offer_inactive');
    if (offer.startsAt && now < offer.startsAt) throw new BadRequestException('offer_not_started');
    if (offer.endsAt && now > offer.endsAt) throw new BadRequestException('expired_offer');

    const existing = await this.prisma.offerRedemption.findFirst({
      where: { userId, offerId },
      select: { code: true, status: true },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.status === 'PENDING') {
      return {
        code: existing.code,
        offerId: offer.id,
        offerTitle: offer.title,
        status: 'PENDING' as const,
      };
    }
    if (existing?.status === 'REDEEMED') {
      throw new BadRequestException('already_redeemed');
    }

    const { eligible } = await this.checkEligibility(userId, offer);
    if (!eligible) throw new BadRequestException('not_eligible');

    let code: string;
    for (;;) {
      code = generateCode();
      const collision = await this.prisma.offerRedemption.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!collision) break;
    }

    await this.prisma.offerRedemption.create({
      data: {
        offerId,
        userId,
        storeId: offer.storeId,
        code: code!,
        status: 'PENDING',
      },
    });

    return { code: code!, offerId: offer.id, offerTitle: offer.title, status: 'PENDING' as const };
  }

  // ---------------------------------------------------------------------------
  // Player: get own redemption status for an offer
  // ---------------------------------------------------------------------------

  async getMyRedemption(userId: string, offerId: string) {
    const redemption = await this.prisma.offerRedemption.findFirst({
      where: { userId, offerId },
      select: { code: true, offerId: true, status: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!redemption) throw new NotFoundException('No redemption found');
    return { code: redemption.code, offerId: redemption.offerId, status: redemption.status };
  }

  // ---------------------------------------------------------------------------
  // Staff: verify a code
  // ---------------------------------------------------------------------------

  async verifyCode(staffUserId: string, storeId: string, code: string) {
    await this.assertOwner(staffUserId, storeId);

    const redemption = await this.prisma.offerRedemption.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        status: true,
        storeId: true,
        userId: true,
        createdAt: true,
        redeemedAt: true,
        offer: {
          select: {
            id: true,
            title: true,
            type: true,
            active: true,
            streakRequired: true,
            endsAt: true,
          },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            pronouns: true,
            bio: true,
            avatarColors: true,
            commander: true,
            powerLevel: true,
            vibes: true,
            formats: true,
          },
        },
      },
    });

    if (!redemption) throw new BadRequestException('not_found');
    if (redemption.storeId !== storeId) throw new BadRequestException('wrong_store');
    if (redemption.status === 'VOID') throw new BadRequestException('not_found');
    if (redemption.status === 'REDEEMED') throw new BadRequestException('already_redeemed');

    const now = new Date();
    const { offer } = redemption;
    if (!offer.active || (offer.endsAt && now > offer.endsAt)) {
      throw new BadRequestException('expired_offer');
    }

    const { eligible, reason } = await this.checkEligibility(redemption.userId, {
      storeId,
      type: offer.type,
      streakRequired: offer.streakRequired,
    });
    if (!eligible) throw new BadRequestException('not_eligible');

    return {
      id: redemption.id,
      code: redemption.code,
      status: redemption.status,
      offer: { id: offer.id, title: offer.title, type: offer.type },
      player: redemption.user,
      qualifyingReason: reason,
      createdAt: redemption.createdAt.toISOString(),
      redeemedAt: redemption.redeemedAt?.toISOString() ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Staff: redeem a code (atomic, idempotency-safe)
  // ---------------------------------------------------------------------------

  async redeemCode(staffUserId: string, storeId: string, code: string) {
    await this.assertOwner(staffUserId, storeId);

    const redemption = await this.prisma.offerRedemption.findUnique({
      where: { code },
      select: {
        id: true,
        status: true,
        storeId: true,
        userId: true,
        offer: {
          select: {
            id: true,
            title: true,
            type: true,
            active: true,
            streakRequired: true,
            endsAt: true,
          },
        },
      },
    });

    if (!redemption) throw new BadRequestException('not_found');
    if (redemption.storeId !== storeId) throw new BadRequestException('wrong_store');
    if (redemption.status === 'VOID') throw new BadRequestException('not_found');
    if (redemption.status === 'REDEEMED') throw new BadRequestException('already_redeemed');

    const now = new Date();
    const { offer } = redemption;
    if (!offer.active || (offer.endsAt && now > offer.endsAt)) {
      throw new BadRequestException('expired_offer');
    }

    const { eligible } = await this.checkEligibility(redemption.userId, {
      storeId,
      type: offer.type,
      streakRequired: offer.streakRequired,
    });
    if (!eligible) throw new BadRequestException('not_eligible');

    // Atomic update: only succeeds if still PENDING
    const { count } = await this.prisma.offerRedemption.updateMany({
      where: { code, status: 'PENDING' },
      data: { status: 'REDEEMED', redeemedAt: now, redeemedByStaffId: staffUserId },
    });

    if (count === 0) {
      throw new BadRequestException('already_redeemed');
    }

    const updated = await this.prisma.offerRedemption.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        status: true,
        createdAt: true,
        redeemedAt: true,
        offer: { select: { id: true, title: true, type: true } },
        user: { select: { id: true, displayName: true, avatarColors: true } },
      },
    });

    return {
      id: updated!.id,
      code: updated!.code,
      status: updated!.status,
      offer: updated!.offer,
      player: updated!.user,
      createdAt: updated!.createdAt.toISOString(),
      redeemedAt: updated!.redeemedAt?.toISOString() ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Staff: list recent redemptions for a store
  // ---------------------------------------------------------------------------

  async listRedemptions(
    staffUserId: string,
    storeId: string,
    opts: { status?: string; limit?: number },
  ) {
    await this.assertOwner(staffUserId, storeId);

    const { status, limit = 50 } = opts;

    const records = await this.prisma.offerRedemption.findMany({
      where: {
        storeId,
        ...(status ? { status: status as 'PENDING' | 'REDEEMED' | 'VOID' } : {}),
      },
      select: {
        id: true,
        code: true,
        status: true,
        createdAt: true,
        redeemedAt: true,
        offer: { select: { title: true, type: true } },
        user: { select: { id: true, displayName: true, avatarColors: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return records.map((r: (typeof records)[number]) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      offerTitle: r.offer.title,
      offerType: r.offer.type,
      player: r.user,
      createdAt: r.createdAt.toISOString(),
      redeemedAt: r.redeemedAt?.toISOString() ?? null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async checkEligibility(
    userId: string,
    offer: { storeId: string; type: string; streakRequired: number | null },
  ): Promise<{ eligible: boolean; reason: string }> {
    const streak = await this.prisma.streak.findUnique({
      where: { userId_storeId: { userId, storeId: offer.storeId } },
      select: { currentStreak: true, totalCheckins: true },
    });

    if (offer.type === 'FIRST_VISIT') {
      const total = streak?.totalCheckins ?? 0;
      if (total === 1) return { eligible: true, reason: 'First visit' };
      if (total === 0) return { eligible: false, reason: 'No check-ins yet' };
      return { eligible: false, reason: 'Not first visit' };
    }

    if (offer.type === 'STREAK') {
      const current = streak?.currentStreak ?? 0;
      const required = offer.streakRequired ?? 1;
      if (current >= required) return { eligible: true, reason: `${current}-week streak` };
      return { eligible: false, reason: `Streak too low (${current}/${required})` };
    }

    return { eligible: false, reason: 'Unknown offer type' };
  }

  private async assertOwner(userId: string, storeId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'ADMIN') return;
    const owns = await this.prisma.storeOwnership.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { id: true },
    });
    if (!owns) throw new ForbiddenException('You do not own this store');
  }
}
