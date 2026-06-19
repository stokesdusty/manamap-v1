import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConnectionStatus, EncounterResult, EncounterSource, NotificationKind } from '@prisma/client';
import { ConnectionsService } from '../connections.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SafetyService } from '../../safety/safety.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { QuestsService } from '../../quests/quests.service';
import { SocialsService } from '../../socials/socials.service';

function makePrismaMock() {
  return {
    $transaction: jest.fn(),
    connection: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    encounter: {
      create: jest.fn(),
    },
  };
}

const PEER = {
  id: 'peer1',
  displayName: 'Peer',
  pronouns: null,
  bio: null,
  avatarColors: [],
  commander: null,
  powerLevel: null,
  vibes: [],
  formats: [],
  spelltable: null,
  convokeGames: false,
  homeStore: null,
};

const PEER_DETAIL = {
  ...PEER,
  name: 'Peer Name',
  identities: [{ discordHandle: 'peer#1234' }],
  deckLinks: [{ id: 'dl1', site: 'MOXFIELD', name: 'Storm', url: 'https://moxfield.com/x' }],
  privacySettings: { showDiscord: true, showDecks: true, shareNameWithContacts: false },
};

function makeConn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn1',
    status: ConnectionStatus.PENDING,
    requesterId: 'caller',
    addresseeId: 'peer1',
    via: null,
    note: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    requester: { ...PEER, id: 'caller', displayName: 'Caller' },
    addressee: { ...PEER, id: 'peer1', displayName: 'Peer' },
    ...overrides,
  };
}

describe('ConnectionsService', () => {
  let service: ConnectionsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let safety: { getBlockedIds: jest.Mock };
  let notifications: { create: jest.Mock };
  let quests: { evaluate: jest.Mock };
  let socials: { visibleSocials: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    safety = { getBlockedIds: jest.fn().mockResolvedValue(new Set()) };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    quests = { evaluate: jest.fn().mockResolvedValue(undefined) };
    socials = { visibleSocials: jest.fn().mockResolvedValue({ socials: [], publicCount: 0, friendsOnlyCount: 0 }) };

    const module = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: PrismaService,        useValue: prisma },
        { provide: SafetyService,        useValue: safety },
        { provide: NotificationsService, useValue: notifications },
        { provide: QuestsService,        useValue: quests },
        { provide: SocialsService,       useValue: socials },
      ],
    }).compile();

    service = module.get(ConnectionsService);
  });

  // -------------------------------------------------------------------------
  // sendRequest
  // -------------------------------------------------------------------------

  describe('sendRequest', () => {
    it('throws BadRequestException when the caller tries to connect with themselves', async () => {
      await expect(service.sendRequest('u1', { addresseeId: 'u1' })).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when the addressee is blocked', async () => {
      safety.getBlockedIds.mockResolvedValue(new Set(['peer1']));
      await expect(service.sendRequest('caller', { addresseeId: 'peer1' })).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when a connection already exists in either direction', async () => {
      prisma.connection.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.sendRequest('caller', { addresseeId: 'peer1' })).rejects.toThrow(ConflictException);
    });

    it('creates the connection and returns its id and pending status', async () => {
      prisma.connection.findFirst.mockResolvedValue(null);
      prisma.connection.create.mockResolvedValue({
        id: 'conn1',
        requester: { displayName: 'Caller' },
      });

      const result = await service.sendRequest('caller', { addresseeId: 'peer1' });

      expect(prisma.connection.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ requesterId: 'caller', addresseeId: 'peer1' }) }),
      );
      expect(result).toEqual({ id: 'conn1', status: 'pending' });
    });

    it('sends a connection_request notification to the addressee', async () => {
      prisma.connection.findFirst.mockResolvedValue(null);
      prisma.connection.create.mockResolvedValue({
        id: 'conn1',
        requester: { displayName: 'Caller' },
      });

      await service.sendRequest('caller', { addresseeId: 'peer1', note: 'Hey!' });

      expect(notifications.create).toHaveBeenCalledWith(
        'peer1',
        expect.objectContaining({ kind: NotificationKind.CONNECT_REQUEST }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // list — bucket logic
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('puts accepted connections in the accepted bucket regardless of direction', async () => {
      prisma.connection.findMany.mockResolvedValue([
        makeConn({ status: ConnectionStatus.ACCEPTED }),
      ]);

      const result = await service.list('caller');
      expect(result.accepted).toHaveLength(1);
      expect(result.incoming).toHaveLength(0);
      expect(result.outgoing).toHaveLength(0);
    });

    it('puts a pending connection sent by caller into outgoing', async () => {
      prisma.connection.findMany.mockResolvedValue([
        makeConn({ requesterId: 'caller', addresseeId: 'peer1' }),
      ]);

      const result = await service.list('caller');
      expect(result.outgoing).toHaveLength(1);
      expect(result.outgoing[0]).toMatchObject({ direction: 'sent' });
    });

    it('puts a pending connection received by caller into incoming', async () => {
      prisma.connection.findMany.mockResolvedValue([
        makeConn({ requesterId: 'peer1', addresseeId: 'caller' }),
      ]);

      const result = await service.list('caller');
      expect(result.incoming).toHaveLength(1);
      expect(result.incoming[0]).toMatchObject({ direction: 'received' });
    });

    it('lowercases the connection status', async () => {
      prisma.connection.findMany.mockResolvedValue([
        makeConn({ status: ConnectionStatus.ACCEPTED }),
      ]);

      const { accepted } = await service.list('caller');
      expect((accepted[0] as { status: string }).status).toBe('accepted');
    });

    it('sets homeStoreName from the peer homeStore name, null when absent', async () => {
      prisma.connection.findMany.mockResolvedValue([
        makeConn({
          requesterId: 'caller',
          addressee: { ...PEER, id: 'peer1', homeStore: { name: 'The Vault' } },
        }),
      ]);

      const { outgoing } = await service.list('caller');
      expect((outgoing[0] as { peer: { homeStoreName: string } }).peer.homeStoreName).toBe('The Vault');
    });

    it('sets homeStoreName to null when peer has no home store', async () => {
      prisma.connection.findMany.mockResolvedValue([makeConn()]);
      const { outgoing } = await service.list('caller');
      expect((outgoing[0] as { peer: { homeStoreName: null } }).peer.homeStoreName).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // accept
  // -------------------------------------------------------------------------

  describe('accept', () => {
    it('throws NotFoundException when the connection does not exist', async () => {
      prisma.connection.findUnique.mockResolvedValue(null);
      await expect(service.accept('caller', 'conn1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the addressee', async () => {
      prisma.connection.findUnique.mockResolvedValue(makeConn({ addresseeId: 'someone-else' }));
      await expect(service.accept('caller', 'conn1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the connection is not pending', async () => {
      prisma.connection.findUnique.mockResolvedValue(
        makeConn({ addresseeId: 'caller', status: ConnectionStatus.ACCEPTED }),
      );
      await expect(service.accept('caller', 'conn1')).rejects.toThrow(BadRequestException);
    });

    it('sets status to ACCEPTED and creates a CONNECTION encounter in a transaction', async () => {
      prisma.connection.findUnique.mockResolvedValue(makeConn({ addresseeId: 'caller' }));
      prisma.connection.update.mockResolvedValue({ id: 'conn1' });
      prisma.encounter.create.mockResolvedValue({});
      prisma.$transaction.mockResolvedValue([{ id: 'conn1' }]);

      await service.accept('caller', 'conn1');

      expect(prisma.connection.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ConnectionStatus.ACCEPTED } }),
      );
      expect(prisma.encounter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: EncounterSource.CONNECTION,
            result: EncounterResult.DRAW,
          }),
        }),
      );
    });

    it('notifies the requester that the request was accepted', async () => {
      prisma.connection.findUnique.mockResolvedValue(makeConn({ addresseeId: 'caller' }));
      prisma.connection.update.mockResolvedValue({ id: 'conn1' });
      prisma.encounter.create.mockResolvedValue({});
      prisma.$transaction.mockResolvedValue([{ id: 'conn1' }]);

      await service.accept('caller', 'conn1');

      expect(notifications.create).toHaveBeenCalledWith(
        'caller', // requesterId on the makeConn default
        expect.objectContaining({ kind: NotificationKind.CONNECT_ACCEPTED }),
      );
    });

    it('calls quests.evaluate for both parties', async () => {
      prisma.connection.findUnique.mockResolvedValue(
        makeConn({ requesterId: 'req1', addresseeId: 'caller' }),
      );
      prisma.connection.update.mockResolvedValue({ id: 'conn1' });
      prisma.encounter.create.mockResolvedValue({});
      prisma.$transaction.mockResolvedValue([{ id: 'conn1' }]);

      await service.accept('caller', 'conn1');

      const evaluatedIds = quests.evaluate.mock.calls.map((c: [string]) => c[0]);
      expect(evaluatedIds).toContain('caller');
      expect(evaluatedIds).toContain('req1');
    });

    it('returns { id, status: "accepted" }', async () => {
      prisma.connection.findUnique.mockResolvedValue(makeConn({ addresseeId: 'caller' }));
      prisma.connection.update.mockResolvedValue({ id: 'conn1' });
      prisma.encounter.create.mockResolvedValue({});
      prisma.$transaction.mockResolvedValue([{ id: 'conn1' }]);

      const result = await service.accept('caller', 'conn1');
      expect(result).toEqual({ id: 'conn1', status: 'accepted' });
    });
  });

  // -------------------------------------------------------------------------
  // decline
  // -------------------------------------------------------------------------

  describe('decline', () => {
    it('throws NotFoundException when the connection does not exist', async () => {
      prisma.connection.findUnique.mockResolvedValue(null);
      await expect(service.decline('caller', 'conn1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the addressee', async () => {
      prisma.connection.findUnique.mockResolvedValue(makeConn({ addresseeId: 'other' }));
      await expect(service.decline('caller', 'conn1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the connection is not pending', async () => {
      prisma.connection.findUnique.mockResolvedValue(
        makeConn({ addresseeId: 'caller', status: ConnectionStatus.ACCEPTED }),
      );
      await expect(service.decline('caller', 'conn1')).rejects.toThrow(BadRequestException);
    });

    it('deletes the connection and returns { success: true }', async () => {
      prisma.connection.findUnique.mockResolvedValue(makeConn({ addresseeId: 'caller' }));
      prisma.connection.delete.mockResolvedValue({});

      const result = await service.decline('caller', 'conn1');

      expect(prisma.connection.delete).toHaveBeenCalledWith({ where: { id: 'conn1' } });
      expect(result).toEqual({ success: true });
    });
  });

  // -------------------------------------------------------------------------
  // getDetail — privacy gates
  // -------------------------------------------------------------------------

  describe('getDetail', () => {
    it('throws NotFoundException when the connection does not exist', async () => {
      prisma.connection.findUnique.mockResolvedValue(null);
      await expect(service.getDetail('caller', 'conn1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not a participant', async () => {
      prisma.connection.findUnique.mockResolvedValue(
        makeConn({ requesterId: 'a', addresseeId: 'b' }),
      );
      await expect(service.getDetail('outsider', 'conn1')).rejects.toThrow(ForbiddenException);
    });

    function makeDetailConn(overrides: Record<string, unknown> = {}) {
      return {
        ...makeConn({ addresseeId: 'caller', status: ConnectionStatus.ACCEPTED }),
        requester: { ...PEER_DETAIL, id: 'peer1' },
        addressee: { ...PEER_DETAIL, id: 'caller', displayName: 'Caller' },
        ...overrides,
      };
    }

    it('exposes discordHandle when accepted and showDiscord is true', async () => {
      const conn = makeDetailConn({ requesterId: 'peer1', addresseeId: 'caller' });
      prisma.connection.findUnique.mockResolvedValue(conn);

      const result = await service.getDetail('caller', 'conn1');
      expect(result.peer.discordHandle).toBe('peer#1234');
    });

    it('hides discordHandle when accepted but showDiscord is false', async () => {
      const conn = makeDetailConn({
        requesterId: 'peer1',
        addresseeId: 'caller',
        requester: { ...PEER_DETAIL, id: 'peer1', privacySettings: { showDiscord: false, showDecks: true, shareNameWithContacts: false } },
      });
      prisma.connection.findUnique.mockResolvedValue(conn);

      const result = await service.getDetail('caller', 'conn1');
      expect(result.peer.discordHandle).toBeNull();
    });

    it('hides discordHandle when the connection is not yet accepted', async () => {
      const conn = makeDetailConn({ requesterId: 'peer1', addresseeId: 'caller', status: ConnectionStatus.PENDING });
      prisma.connection.findUnique.mockResolvedValue(conn);

      const result = await service.getDetail('caller', 'conn1');
      expect(result.peer.discordHandle).toBeNull();
    });

    it('returns deck links (with lowercased site) when accepted and showDecks is true', async () => {
      const conn = makeDetailConn({ requesterId: 'peer1', addresseeId: 'caller' });
      prisma.connection.findUnique.mockResolvedValue(conn);

      const result = await service.getDetail('caller', 'conn1');
      expect(result.peer.deckLinks).toHaveLength(1);
      expect(result.peer.deckLinks[0]).toMatchObject({ site: 'moxfield' });
    });

    it('returns empty deck links when accepted but showDecks is false', async () => {
      const conn = makeDetailConn({
        requesterId: 'peer1',
        addresseeId: 'caller',
        requester: { ...PEER_DETAIL, id: 'peer1', privacySettings: { showDiscord: true, showDecks: false, shareNameWithContacts: false } },
      });
      prisma.connection.findUnique.mockResolvedValue(conn);

      const result = await service.getDetail('caller', 'conn1');
      expect(result.peer.deckLinks).toHaveLength(0);
    });

    it('returns the real name when accepted and shareNameWithContacts is true', async () => {
      const conn = makeDetailConn({
        requesterId: 'peer1',
        addresseeId: 'caller',
        requester: { ...PEER_DETAIL, id: 'peer1', name: 'Jane Smith', privacySettings: { showDiscord: true, showDecks: true, shareNameWithContacts: true } },
      });
      prisma.connection.findUnique.mockResolvedValue(conn);

      const result = await service.getDetail('caller', 'conn1');
      expect(result.peer.name).toBe('Jane Smith');
    });

    it('hides the real name when shareNameWithContacts is false', async () => {
      const conn = makeDetailConn({ requesterId: 'peer1', addresseeId: 'caller' });
      prisma.connection.findUnique.mockResolvedValue(conn);

      const result = await service.getDetail('caller', 'conn1');
      expect(result.peer.name).toBeNull();
    });

    it('skips visibleSocials call when connection is not accepted', async () => {
      const conn = makeDetailConn({ requesterId: 'peer1', addresseeId: 'caller', status: ConnectionStatus.PENDING });
      prisma.connection.findUnique.mockResolvedValue(conn);

      await service.getDetail('caller', 'conn1');

      expect(socials.visibleSocials).not.toHaveBeenCalled();
    });
  });
});
