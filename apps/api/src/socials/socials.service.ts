import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionStatus } from '@prisma/client';
import type { SocialLinkInput, UpdateSocialLink } from '@manamap/shared';
import { PrismaService } from '../prisma/prisma.service';

export type SocialLinkRow = {
  id: string;
  platform: string;
  value: string;
  visibility: string;
  sort: number;
};

const SOCIAL_SELECT = {
  id: true,
  platform: true,
  value: true,
  visibility: true,
  sort: true,
} as const;

function normalizeValue(platform: string, raw: string): string {
  let v = raw.trim();
  switch (platform) {
    case 'WEBSITE':
      try {
        new URL(v);
      } catch {
        throw new BadRequestException('WEBSITE value must be a valid URL');
      }
      if (v.length > 256) throw new BadRequestException('URL too long');
      return v;
    case 'PHONE':
      if (!/^[+\d\s\-().]{5,30}$/.test(v)) {
        throw new BadRequestException('PHONE must be a valid phone number (e.g. +1 555-123-4567)');
      }
      return v;
    default:
      if (v.startsWith('@')) v = v.slice(1);
      if (!v) throw new BadRequestException('Handle cannot be empty');
      if (v.length > 128) throw new BadRequestException('Handle too long');
      return v;
  }
}

@Injectable()
export class SocialsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<SocialLinkRow[]> {
    return this.prisma.socialLink.findMany({
      where: { userId },
      orderBy: { sort: 'asc' },
      select: SOCIAL_SELECT,
    });
  }

  async add(userId: string, dto: SocialLinkInput): Promise<SocialLinkRow> {
    const platform = dto.platform;
    const visibility = dto.visibility ?? 'PUBLIC';
    const value = normalizeValue(platform, dto.value);

    const existing = await this.prisma.socialLink.findUnique({
      where: { userId_platform: { userId, platform } },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`${platform} link already exists`);

    const maxResult = await this.prisma.socialLink.aggregate({
      where: { userId },
      _max: { sort: true },
    });

    return this.prisma.socialLink.create({
      data: { userId, platform, value, visibility, sort: (maxResult._max.sort ?? -1) + 1 },
      select: SOCIAL_SELECT,
    });
  }

  async update(userId: string, linkId: string, dto: UpdateSocialLink): Promise<SocialLinkRow> {
    const existing = await this.prisma.socialLink.findFirst({
      where: { id: linkId, userId },
    });
    if (!existing) throw new NotFoundException('Social link not found');

    const value =
      dto.value !== undefined ? normalizeValue(existing.platform, dto.value) : undefined;
    const visibility = dto.visibility;

    return this.prisma.socialLink.update({
      where: { id: linkId },
      data: {
        ...(value !== undefined ? { value } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
      },
      select: SOCIAL_SELECT,
    });
  }

  async remove(userId: string, linkId: string): Promise<void> {
    const existing = await this.prisma.socialLink.findFirst({
      where: { id: linkId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Social link not found');
    await this.prisma.socialLink.delete({ where: { id: linkId } });
  }

  async reorder(userId: string, order: string[]): Promise<SocialLinkRow[]> {
    const links = await this.prisma.socialLink.findMany({
      where: { userId, id: { in: order } },
      select: { id: true },
    });
    if (links.length !== order.length) {
      throw new BadRequestException('Some link IDs not found or do not belong to you');
    }

    await this.prisma.$transaction(
      order.map((id, i) => this.prisma.socialLink.update({ where: { id }, data: { sort: i } })),
    );

    return this.list(userId);
  }

  async visibleSocials(
    targetUserId: string,
    viewerId: string,
  ): Promise<{ socials: SocialLinkRow[]; publicCount: number; friendsOnlyCount: number }> {
    const allLinks = await this.prisma.socialLink.findMany({
      where: { userId: targetUserId },
      orderBy: { sort: 'asc' },
      select: SOCIAL_SELECT,
    });

    const publicCount = allLinks.filter((l) => l.visibility === 'PUBLIC').length;
    const friendsOnlyCount = allLinks.filter((l) => l.visibility === 'FRIENDS').length;

    let isConnected = viewerId === targetUserId;
    if (!isConnected) {
      const conn = await this.prisma.connection.findFirst({
        where: {
          OR: [
            { requesterId: viewerId, addresseeId: targetUserId },
            { requesterId: targetUserId, addresseeId: viewerId },
          ],
          status: ConnectionStatus.ACCEPTED,
        },
        select: { id: true },
      });
      isConnected = !!conn;
    }

    const socials = isConnected
      ? allLinks.filter((l) => l.visibility !== 'HIDDEN')
      : allLinks.filter((l) => l.visibility === 'PUBLIC');

    return { socials, publicCount, friendsOnlyCount };
  }

  async publicSocialsBatch(
    userIds: string[],
  ): Promise<Map<string, { socials: SocialLinkRow[]; friendsOnlyCount: number }>> {
    if (!userIds.length) return new Map();

    const [publicLinks, friendsCounts] = await Promise.all([
      this.prisma.socialLink.findMany({
        where: { userId: { in: userIds }, visibility: 'PUBLIC' },
        orderBy: { sort: 'asc' },
        select: {
          id: true,
          userId: true,
          platform: true,
          value: true,
          visibility: true,
          sort: true,
        },
      }),
      this.prisma.socialLink.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, visibility: 'FRIENDS' },
        _count: { id: true },
      }),
    ]);

    const result = new Map<string, { socials: SocialLinkRow[]; friendsOnlyCount: number }>();
    for (const id of userIds) result.set(id, { socials: [], friendsOnlyCount: 0 });

    for (const { userId: uid, ...link } of publicLinks) {
      result.get(uid)?.socials.push(link);
    }
    for (const fc of friendsCounts) {
      const entry = result.get(fc.userId);
      if (entry) entry.friendsOnlyCount = fc._count.id;
    }

    return result;
  }
}
