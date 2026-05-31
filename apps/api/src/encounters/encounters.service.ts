import { Injectable } from '@nestjs/common';
import { ConnectionStatus } from '@prisma/client';
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
export class EncountersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    // Fetch last 100 encounters for this user (both directions), with peer + store
    const [rawEncounters, connections] = await Promise.all([
      this.prisma.encounter.findMany({
        where: { OR: [{ userId }, { opponentId: userId }] },
        select: {
          id: true,
          userId: true,
          opponentId: true,
          source: true,
          createdAt: true,
          store: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.connection.findMany({
        where: {
          status: ConnectionStatus.ACCEPTED,
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        select: { requesterId: true, addresseeId: true },
      }),
    ]);

    // Build connected-ids set for crossedPathsCount
    const connectedIds = new Set(
      connections.map((c) => (c.requesterId === userId ? c.addresseeId : c.requesterId)),
    );

    // Collect unique peer ids for a single profile + privacy fetch
    const peerIds = [...new Set(rawEncounters.map((e) => (e.userId === userId ? e.opponentId : e.userId)))];

    const peers = await this.prisma.user.findMany({
      where: { id: { in: peerIds } },
      select: {
        ...PEER_SELECT,
        privacySettings: { select: { showMetHistory: true } },
      },
    });
    const peerMap = new Map(peers.map((p) => [p.id, p]));

    // Filter: CONNECTION source always shown (mutual consent); others require showMetHistory = true
    const filtered = rawEncounters.filter((e) => {
      const peerId = e.userId === userId ? e.opponentId : e.userId;
      const peer = peerMap.get(peerId);
      if (!peer) return false;
      if (e.source === 'CONNECTION') return true;
      return peer.privacySettings?.showMetHistory !== false;
    });

    // crossedPathsCount: distinct peers from ALL encounters (pre-filter) not in accepted connections
    const encounteredNotConnected = new Set<string>();
    for (const e of rawEncounters) {
      const peerId = e.userId === userId ? e.opponentId : e.userId;
      if (!connectedIds.has(peerId)) encounteredNotConnected.add(peerId);
    }

    return {
      encounters: filtered.map((e) => {
        const peerId = e.userId === userId ? e.opponentId : e.userId;
        const { privacySettings: _p, ...peerBase } = peerMap.get(peerId)!;
        return {
          id: e.id,
          source: e.source as 'PRESENCE' | 'CONNECTION' | 'GAME',
          peer: {
            ...peerBase,
            pronouns: peerBase.pronouns ?? null,
            bio: peerBase.bio ?? null,
            commander: peerBase.commander ?? null,
            powerLevel: peerBase.powerLevel ?? null,
            vibe: peerBase.vibe ?? null,
          },
          storeId: e.store?.id ?? null,
          storeName: e.store?.name ?? null,
          createdAt: e.createdAt.toISOString(),
        };
      }),
      crossedPathsCount: encounteredNotConnected.size,
    };
  }
}
