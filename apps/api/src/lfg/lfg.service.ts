import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import {
  EncounterResult,
  EncounterSource,
  ModerationStatus,
  NotificationKind,
} from '@prisma/client';
import type { CreateLfg, UpdateLfg, LfgLockBody } from '@manamap/shared';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';
import { NotificationsService } from '../notifications/notifications.service';

const presenceKey = (userId: string) => `presence:${userId}`;
const lfgKey = (userId: string) => `lfg:${userId}`;
const lfgStoreKey = (storeId: string) => `lfg_store:${storeId}`;

export interface LfgSession {
  storeId: string;
  format: string | null;
  power: number;
  seats: number;
  durationMins: 30 | 60 | 120;
  note: string | null;
  createdAt: string;
  expiresAt: string;
}

const PROFILE_SELECT = {
  id: true,
  displayName: true,
  pronouns: true,
  bio: true,
  avatarColors: true,
  commander: true,
  powerLevel: true,
  vibes: true,
  formats: true,
} as const;

@Injectable()
export class LfgService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getActiveSession(userId: string): Promise<LfgSession | null> {
    const raw = await this.redis.get(lfgKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as LfgSession;
  }

  async getMySession(userId: string): Promise<LfgSession | null> {
    return this.getActiveSession(userId);
  }

  async create(userId: string, dto: CreateLfg): Promise<LfgSession> {
    const storeId = await this.redis.get(presenceKey(userId));
    if (!storeId) throw new ConflictException('not_checked_in');

    const now = new Date();
    const durationSecs = dto.durationMins * 60;
    const expiresAt = new Date(now.getTime() + durationSecs * 1000);

    const session: LfgSession = {
      storeId,
      format: dto.format ?? null,
      power: dto.power,
      seats: dto.seats,
      durationMins: dto.durationMins,
      note: dto.note ?? null,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await Promise.all([
      this.redis.setex(lfgKey(userId), durationSecs, JSON.stringify(session)),
      this.redis.zadd(lfgStoreKey(storeId), expiresAt.getTime(), userId),
    ]);

    return session;
  }

  async update(userId: string, dto: UpdateLfg): Promise<LfgSession> {
    const existing = await this.getActiveSession(userId);
    if (!existing) throw new NotFoundException('No active LFG session');

    const now = Date.now();
    const existingExpiry = new Date(existing.expiresAt).getTime();
    const remainingSecs = Math.max(1, Math.floor((existingExpiry - now) / 1000));

    const durationChanged =
      dto.durationMins !== undefined && dto.durationMins !== existing.durationMins;
    const newDurationMins = dto.durationMins ?? existing.durationMins;
    const newExpiresAt = durationChanged
      ? new Date(now + newDurationMins * 60 * 1000).toISOString()
      : existing.expiresAt;
    const newTtlSecs = durationChanged ? newDurationMins * 60 : remainingSecs;

    const updated: LfgSession = {
      ...existing,
      ...(dto.format !== undefined ? { format: dto.format ?? null } : {}),
      ...(dto.power !== undefined ? { power: dto.power } : {}),
      ...(dto.seats !== undefined ? { seats: dto.seats } : {}),
      durationMins: newDurationMins,
      ...(dto.note !== undefined ? { note: dto.note ?? null } : {}),
      expiresAt: newExpiresAt,
    };

    await Promise.all([
      this.redis.setex(lfgKey(userId), newTtlSecs, JSON.stringify(updated)),
      durationChanged
        ? this.redis.zadd(lfgStoreKey(existing.storeId), new Date(newExpiresAt).getTime(), userId)
        : Promise.resolve(),
    ]);

    return updated;
  }

  async remove(userId: string): Promise<void> {
    const existing = await this.getActiveSession(userId);
    if (!existing) return;
    await Promise.all([
      this.redis.del(lfgKey(userId)),
      this.redis.zrem(lfgStoreKey(existing.storeId), userId),
    ]);
  }

  async feed(callerId: string) {
    const [storeId, blockedIds] = await Promise.all([
      this.redis.get(presenceKey(callerId)),
      this.safety.getBlockedIds(callerId),
    ]);
    if (!storeId) return [];

    const now = Date.now();
    const rawMembers = await this.redis.zrange(lfgStoreKey(storeId), 0, -1);
    const otherMembers = rawMembers.filter((id) => id !== callerId && !blockedIds.has(id));
    if (!otherMembers.length) return [];

    // Prune expired LFG sessions (mirror presence prune pattern)
    const existChecks = await Promise.all(otherMembers.map((id) => this.redis.exists(lfgKey(id))));
    const validIds: string[] = [];
    const expiredIds: string[] = [];
    otherMembers.forEach((id, i) => {
      if (existChecks[i]) validIds.push(id);
      else expiredIds.push(id);
    });
    if (expiredIds.length) await this.redis.zrem(lfgStoreKey(storeId), ...expiredIds);
    if (!validIds.length) return [];

    // Verify presence — must currently be checked in at this same store
    const presenceChecks = await Promise.all(validIds.map((id) => this.redis.get(presenceKey(id))));
    const presentIds = validIds.filter((_, i) => presenceChecks[i] === storeId);
    if (!presentIds.length) return [];

    const [users, encounters] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: presentIds }, moderationStatus: ModerationStatus.ACTIVE },
        select: { ...PROFILE_SELECT, privacySettings: { select: { discoverable: true } } },
      }),
      this.prisma.encounter.findMany({
        where: {
          OR: [
            { userId: callerId, opponentId: { in: presentIds } },
            { userId: { in: presentIds }, opponentId: callerId },
          ],
        },
        select: { userId: true, opponentId: true },
        take: 200,
      }),
    ]);

    const metBeforeSet = new Set<string>();
    for (const e of encounters) {
      metBeforeSet.add(e.userId === callerId ? e.opponentId : e.userId);
    }

    const results = [];
    for (const user of users) {
      if (user.privacySettings?.discoverable === false) continue;

      const session = await this.getActiveSession(user.id);
      if (!session) continue;

      const minutesLeft = Math.max(
        0,
        Math.ceil((new Date(session.expiresAt).getTime() - now) / 60000),
      );
      const { privacySettings: _ps, ...profile } = user;

      results.push({
        ...profile,
        pronouns: profile.pronouns ?? null,
        bio: profile.bio ?? null,
        commander: profile.commander ?? null,
        powerLevel: profile.powerLevel ?? null,
        vibes: profile.vibes ?? [],
        session,
        minutesLeft,
        metBefore: metBeforeSet.has(user.id),
      });
    }

    return results;
  }

  async invite(callerId: string, hostUserId: string) {
    if (callerId === hostUserId) throw new ForbiddenException('Cannot invite yourself');

    const [hostSession, caller] = await Promise.all([
      this.getActiveSession(hostUserId),
      this.prisma.user.findUnique({ where: { id: callerId }, select: { displayName: true } }),
    ]);
    if (!hostSession) throw new NotFoundException('Host has no active LFG session');

    void this.notifications.create(hostUserId, {
      kind: NotificationKind.POD,
      title: `${caller?.displayName ?? 'Someone'} wants to join your pod`,
      body: 'Tap to manage your LFG session',
      data: { type: 'lfg_join_request', userId: callerId },
    });

    return { success: true };
  }

  async lock(callerId: string, hostUserId: string, dto: LfgLockBody) {
    if (callerId !== hostUserId) throw new ForbiddenException('Only the host can lock the pod');

    const session = await this.getActiveSession(hostUserId);
    if (!session) throw new NotFoundException('No active LFG session');

    const memberIds = [...new Set([hostUserId, ...dto.memberIds])];
    const pairs: Array<{ userId: string; opponentId: string }> = [];
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        pairs.push({ userId: memberIds[i], opponentId: memberIds[j] });
        pairs.push({ userId: memberIds[j], opponentId: memberIds[i] });
      }
    }

    if (pairs.length > 0) {
      await this.prisma.encounter.createMany({
        data: pairs.map(({ userId, opponentId }) => ({
          userId,
          opponentId,
          storeId: session.storeId,
          source: EncounterSource.GAME,
          result: EncounterResult.DRAW,
          notes: 'Pod formed via LFG',
        })),
        skipDuplicates: true,
      });
    }

    await Promise.all([
      this.redis.del(lfgKey(hostUserId)),
      this.redis.zrem(lfgStoreKey(session.storeId), hostUserId),
    ]);

    return { success: true };
  }
}
