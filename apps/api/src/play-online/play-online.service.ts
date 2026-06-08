import { BadRequestException, Injectable } from '@nestjs/common';
import { ConnectionStatus, NotificationKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PlayOnlineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async sendInvites(
    callerId: string,
    platform: 'spelltable' | 'convoke',
    roomLink: string,
    connectionIds: string[],
  ): Promise<{ sent: number }> {
    const connections = await this.prisma.connection.findMany({
      where: {
        id: { in: connectionIds },
        status: ConnectionStatus.ACCEPTED,
        OR: [{ requesterId: callerId }, { addresseeId: callerId }],
      },
      select: { id: true, requesterId: true, addresseeId: true },
    });

    if (connections.length !== connectionIds.length) {
      throw new BadRequestException('One or more connection IDs are invalid or not accepted');
    }

    const caller = await this.prisma.user.findUniqueOrThrow({
      where: { id: callerId },
      select: { displayName: true },
    });

    const recipientIds = connections.map((c) =>
      c.requesterId === callerId ? c.addresseeId : c.requesterId,
    );

    const platformLabel = platform === 'spelltable' ? 'SpellTable' : 'Convoke';

    await this.notifications.createBulk(recipientIds, {
      kind: NotificationKind.PLAY_INVITE,
      title: `${caller.displayName} invited you to play`,
      body: `Join on ${platformLabel}: ${roomLink}`,
      data: { type: 'play_invite', platform, roomLink, inviterName: caller.displayName },
    });

    return { sent: recipientIds.length };
  }
}
