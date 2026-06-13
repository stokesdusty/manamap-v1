import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { SocialsService } from '../socials/socials.service';

const TTL_SECONDS = 60;

@Injectable()
export class ExchangeService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
    private readonly socials: SocialsService,
  ) {}

  async mintToken(userId: string): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(16).toString('hex');
    await this.redis.set(`exchange:${token}`, userId, 'EX', TTL_SECONDS);
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
    return { token, expiresAt };
  }

  async resolveToken(callerId: string, token: string) {
    const userId = await this.redis.get(`exchange:${token}`);
    if (!userId) throw new GoneException('Token expired or invalid');

    const [user, blockedIds, socialsData] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true, pronouns: true, bio: true, avatarColors: true, commander: true, powerLevel: true, vibes: true, formats: true, moderationStatus: true } }),
      this.safety.getBlockedIds(callerId),
      this.socials.visibleSocials(userId, callerId),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (blockedIds.has(userId)) throw new NotFoundException('User not found');
    if (user.moderationStatus !== 'ACTIVE') throw new NotFoundException('User not found');

    return {
      id: user.id,
      displayName: user.displayName,
      pronouns: user.pronouns,
      bio: user.bio,
      avatarColors: user.avatarColors,
      commander: user.commander,
      powerLevel: user.powerLevel,
      vibes: user.vibes,
      formats: user.formats,
      socials: socialsData.socials,
      socialsSummary: {
        publicCount: socialsData.publicCount,
        friendsOnlyCount: socialsData.friendsOnlyCount,
      },
    };
  }
}
