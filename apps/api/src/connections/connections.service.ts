import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionStatus, EncounterResult, EncounterSource, NotificationKind } from '@prisma/client';
import type { CreateConnection } from '@manamap/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuestsService } from '../quests/quests.service';
import { SocialsService } from '../socials/socials.service';

const PEER_SELECT = {
  id: true,
  displayName: true,
  pronouns: true,
  bio: true,
  avatarColors: true,
  commander: true,
  powerLevel: true,
  vibes: true,
  formats: true,
  spelltable: true,
  convokeGames: true,
  homeStore: { select: { name: true } },
} as const;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationsService,
    private readonly quests: QuestsService,
    private readonly socials: SocialsService,
  ) {}

  // -------------------------------------------------------------------------
  // Endpoints
  // -------------------------------------------------------------------------

  async sendRequest(requesterId: string, dto: CreateConnection) {
    if (requesterId === dto.addresseeId) {
      throw new BadRequestException('Cannot connect with yourself');
    }

    const blockedIds = await this.safety.getBlockedIds(requesterId);
    if (blockedIds.has(dto.addresseeId)) {
      throw new ForbiddenException('Cannot connect with this user');
    }

    const existing = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: dto.addresseeId },
          { requesterId: dto.addresseeId, addresseeId: requesterId },
        ],
      },
    });
    if (existing) throw new ConflictException('Connection already exists');

    const conn = await this.prisma.connection.create({
      data: {
        requesterId,
        addresseeId: dto.addresseeId,
        via: dto.via ?? null,
        note: dto.note ?? null,
      },
      include: { requester: { select: PEER_SELECT } },
    });

    void this.notifications.create(dto.addresseeId, {
      kind: NotificationKind.CONNECT_REQUEST,
      title: `${conn.requester.displayName} wants to connect`,
      body: dto.note ?? 'Tap to respond',
      data: { type: 'connection_request', connectionId: conn.id },
    });

    return { id: conn.id, status: 'pending' };
  }

  async list(userId: string) {
    const rows = await this.prisma.connection.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        NOT: { status: ConnectionStatus.BLOCKED },
      },
      include: {
        requester: { select: PEER_SELECT },
        addressee: { select: PEER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    const incoming: object[] = [];
    const outgoing: object[] = [];
    const accepted: object[] = [];

    for (const c of rows) {
      const isSender = c.requesterId === userId;
      const peerRaw = isSender ? c.addressee : c.requester;
      const { homeStore, ...peerBase } = peerRaw;
      const item = {
        id: c.id,
        status: c.status.toLowerCase(),
        direction: isSender ? 'sent' : 'received',
        via: c.via,
        note: c.note,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        peer: { ...peerBase, homeStoreName: homeStore?.name ?? null },
      };

      if (c.status === ConnectionStatus.ACCEPTED) {
        accepted.push(item);
      } else if (isSender) {
        outgoing.push(item);
      } else {
        incoming.push(item);
      }
    }

    return { incoming, outgoing, accepted };
  }

  async accept(userId: string, connectionId: string) {
    const conn = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        requester: { select: PEER_SELECT },
        addressee: { select: PEER_SELECT },
      },
    });
    if (!conn) throw new NotFoundException('Connection not found');
    if (conn.addresseeId !== userId) throw new ForbiddenException();
    if (conn.status !== ConnectionStatus.PENDING) {
      throw new BadRequestException('Connection is not pending');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.connection.update({
        where: { id: connectionId },
        data: { status: ConnectionStatus.ACCEPTED },
      }),
      this.prisma.encounter.create({
        data: {
          userId: conn.requesterId,
          opponentId: conn.addresseeId,
          source: EncounterSource.CONNECTION,
          result: EncounterResult.DRAW,
          notes: 'Connected via ManaMap',
        },
      }),
    ]);

    void this.notifications.create(conn.requesterId, {
      kind: NotificationKind.CONNECT_ACCEPTED,
      title: `${conn.addressee.displayName} accepted your request`,
      body: 'You are now connected!',
      data: { type: 'connection_accepted', connectionId: conn.id },
    });

    void this.quests.evaluate(userId);
    void this.quests.evaluate(conn.requesterId);

    return { id: updated.id, status: 'accepted' };
  }

  async decline(userId: string, connectionId: string) {
    const conn = await this.prisma.connection.findUnique({
      where: { id: connectionId },
    });
    if (!conn) throw new NotFoundException('Connection not found');
    if (conn.addresseeId !== userId) throw new ForbiddenException();
    if (conn.status !== ConnectionStatus.PENDING) {
      throw new BadRequestException('Connection is not pending');
    }

    await this.prisma.connection.delete({ where: { id: connectionId } });
    return { success: true };
  }

  async getDetail(userId: string, connectionId: string) {
    const conn = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        requester: {
          select: {
            ...PEER_SELECT,
            name: true,
            identities: { select: { discordHandle: true } },
            deckLinks: { select: { id: true, site: true, name: true, url: true } },
            privacySettings: { select: { showDiscord: true, showDecks: true, shareNameWithContacts: true } },
          },
        },
        addressee: {
          select: {
            ...PEER_SELECT,
            name: true,
            identities: { select: { discordHandle: true } },
            deckLinks: { select: { id: true, site: true, name: true, url: true } },
            privacySettings: { select: { showDiscord: true, showDecks: true, shareNameWithContacts: true } },
          },
        },
      },
    });

    if (!conn) throw new NotFoundException('Connection not found');
    if (conn.requesterId !== userId && conn.addresseeId !== userId) {
      throw new ForbiddenException();
    }

    const isSender = conn.requesterId === userId;
    const peerRaw = isSender ? conn.addressee : conn.requester;

    const accepted = conn.status === ConnectionStatus.ACCEPTED;
    const showDiscord = accepted && (peerRaw.privacySettings?.showDiscord ?? true);
    const showDecks = accepted && (peerRaw.privacySettings?.showDecks ?? true);
    const showName = accepted && (peerRaw.privacySettings?.shareNameWithContacts ?? false);

    const discordHandle = showDiscord
      ? (peerRaw.identities.find((i) => i.discordHandle)?.discordHandle ?? null)
      : null;

    const deckLinks = showDecks
      ? peerRaw.deckLinks.map((d) => ({ ...d, site: d.site.toLowerCase() }))
      : [];

    const socialsData = accepted
      ? await this.socials.visibleSocials(peerRaw.id, userId)
      : { socials: [], publicCount: 0, friendsOnlyCount: 0 };

    const { identities: _i, deckLinks: _d, privacySettings: _p, name: peerName, ...peerBase } = peerRaw;

    return {
      id: conn.id,
      status: conn.status.toLowerCase(),
      direction: isSender ? 'sent' : 'received',
      via: conn.via,
      note: conn.note,
      createdAt: conn.createdAt.toISOString(),
      updatedAt: conn.updatedAt.toISOString(),
      peer: {
        ...peerBase,
        name: showName ? (peerName ?? null) : null,
        discordHandle,
        deckLinks,
        socials: socialsData.socials,
        socialsSummary: {
          publicCount: socialsData.publicCount,
          friendsOnlyCount: socialsData.friendsOnlyCount,
        },
      },
    };
  }
}
