import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConnectionStatus, EncounterResult, EncounterSource } from '@prisma/client';
import { Expo } from 'expo-server-sdk';
import type { ExpoPushMessage } from 'expo-server-sdk';
import type { CreateConnection } from '@manamap/shared';
import { PrismaService } from '../prisma/prisma.service';

const PEER_SELECT = {
  id: true,
  displayName: true,
  pronouns: true,
  bio: true,
  avatarColors: true,
  commander: true,
  powerLevel: true,
  vibe: true,
  formats: true,
} as const;

@Injectable()
export class ConnectionsService {
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Push helpers
  // -------------------------------------------------------------------------

  private async sendPushToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ) {
    const rows = await this.prisma.pushToken.findMany({ where: { userId } });
    const valid = rows.filter((r) => Expo.isExpoPushToken(r.token));
    if (!valid.length) return;

    const messages: ExpoPushMessage[] = valid.map((r) => ({
      to: r.token,
      title: payload.title,
      body: payload.body,
      ...(payload.data !== undefined ? { data: payload.data } : {}),
    }));

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await this.expo.sendPushNotificationsAsync(chunk);
      }
    } catch {
      // Push failures must not affect the main operation
    }
  }

  // -------------------------------------------------------------------------
  // Endpoints
  // -------------------------------------------------------------------------

  async sendRequest(requesterId: string, dto: CreateConnection) {
    if (requesterId === dto.addresseeId) {
      throw new BadRequestException('Cannot connect with yourself');
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

    void this.sendPushToUser(dto.addresseeId, {
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
      const peer = isSender ? c.addressee : c.requester;
      const item = {
        id: c.id,
        status: c.status.toLowerCase(),
        direction: isSender ? 'sent' : 'received',
        via: c.via,
        note: c.note,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        peer,
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

    void this.sendPushToUser(conn.requesterId, {
      title: `${conn.addressee.displayName} accepted your request`,
      body: 'You are now connected!',
      data: { type: 'connection_accepted', connectionId: conn.id },
    });

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
            identities: { select: { discordHandle: true } },
            deckLinks: { select: { id: true, site: true, name: true, url: true } },
            privacySettings: { select: { showDiscord: true, showDecks: true } },
          },
        },
        addressee: {
          select: {
            ...PEER_SELECT,
            identities: { select: { discordHandle: true } },
            deckLinks: { select: { id: true, site: true, name: true, url: true } },
            privacySettings: { select: { showDiscord: true, showDecks: true } },
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

    const discordHandle = showDiscord
      ? (peerRaw.identities.find((i) => i.discordHandle)?.discordHandle ?? null)
      : null;

    const deckLinks = showDecks
      ? peerRaw.deckLinks.map((d) => ({ ...d, site: d.site.toLowerCase() }))
      : [];

    const { identities: _i, deckLinks: _d, privacySettings: _p, ...peerBase } = peerRaw;

    return {
      id: conn.id,
      status: conn.status.toLowerCase(),
      direction: isSender ? 'sent' : 'received',
      via: conn.via,
      note: conn.note,
      createdAt: conn.createdAt.toISOString(),
      updatedAt: conn.updatedAt.toISOString(),
      peer: { ...peerBase, discordHandle, deckLinks },
    };
  }
}
