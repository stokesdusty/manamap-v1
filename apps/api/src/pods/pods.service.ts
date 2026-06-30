import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import {
  EncounterResult,
  EncounterSource,
  ModerationStatus,
  NotificationKind,
} from '@prisma/client';
import type { CreatePod, PodMemberAction } from '@manamap/shared';
import { REDIS } from '../redis/redis.module';
import type { PrismaService } from '../prisma/prisma.service';
import type { SafetyService } from '../safety/safety.service';
import type { NotificationsService } from '../notifications/notifications.service';

const presenceKey = (userId: string) => `presence:${userId}`;
const storeMembersKey = (storeId: string) => `store_members:${storeId}`;
const podKey = (podId: string) => `pod:${podId}`;
const podStoreKey = (storeId: string) => `pod_store:${storeId}`;
const userPodKey = (userId: string) => `user_pod:${userId}`;

const POD_TTL_SECS = 90 * 60;

export interface PodSession {
  id: string;
  hostId: string;
  storeId: string;
  format: string | null;
  targetPower: number;
  tolerance: number;
  seats: number;
  where: string;
  note: string | null;
  memberIds: string[];
  requestIds: string[];
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

type FitTier = 'great' | 'close' | 'off';

function computeFit(
  callerPowerLevel: number | null,
  callerFormats: string[],
  pod: PodSession,
): { tier: FitTier; label: string } {
  if (callerPowerLevel == null) {
    return { tier: 'off', label: 'Power level unknown' };
  }
  const formatMatch = pod.format == null || callerFormats.includes(pod.format);
  const diff = Math.abs(callerPowerLevel - pod.targetPower);
  let tier: FitTier;
  if (formatMatch && diff <= pod.tolerance) {
    tier = 'great';
  } else if (formatMatch && diff <= pod.tolerance + 1) {
    tier = 'close';
  } else {
    tier = 'off';
  }
  const rangeLabel = `${pod.targetPower}±${pod.tolerance}`;
  const label =
    tier !== 'off'
      ? `Power ${callerPowerLevel} fits ${rangeLabel}${pod.format ? ` · ${pod.format}` : ''}`
      : `Power ${callerPowerLevel} outside ${rangeLabel}`;
  return { tier, label };
}

function normalizeProfile(u: {
  id: string;
  displayName: string;
  pronouns: string | null;
  bio: string | null;
  avatarColors: string[];
  commander: string | null;
  powerLevel: number | null;
  vibes: string[];
  formats: string[];
}) {
  return {
    id: u.id,
    displayName: u.displayName,
    pronouns: u.pronouns ?? null,
    bio: u.bio ?? null,
    avatarColors: u.avatarColors,
    commander: u.commander ?? null,
    powerLevel: u.powerLevel ?? null,
    vibes: u.vibes ?? [],
    formats: u.formats,
  };
}

@Injectable()
export class PodsService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getPod(podId: string): Promise<PodSession | null> {
    const raw = await this.redis.get(podKey(podId));
    if (!raw) return null;
    return JSON.parse(raw) as PodSession;
  }

  private async savePod(pod: PodSession, ttlSecs: number): Promise<void> {
    await this.redis.setex(podKey(pod.id), ttlSecs, JSON.stringify(pod));
  }

  private async disbandPod(pod: PodSession): Promise<void> {
    await Promise.all([
      this.redis.del(podKey(pod.id)),
      this.redis.srem(podStoreKey(pod.storeId), pod.id),
      this.redis.del(userPodKey(pod.hostId)),
    ]);
  }

  private remainingSecs(pod: PodSession): number {
    return Math.max(1, Math.ceil((new Date(pod.expiresAt).getTime() - Date.now()) / 1000));
  }

  async create(userId: string, dto: CreatePod): Promise<PodSession> {
    const [storeId, existingPodId] = await Promise.all([
      this.redis.get(presenceKey(userId)),
      this.redis.get(userPodKey(userId)),
    ]);
    if (!storeId) throw new ConflictException('not_checked_in');
    if (existingPodId) throw new ConflictException('already_hosting');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + POD_TTL_SECS * 1000);
    const podId = randomUUID();

    const pod: PodSession = {
      id: podId,
      hostId: userId,
      storeId,
      format: dto.format ?? null,
      targetPower: dto.targetPower,
      tolerance: dto.tolerance,
      seats: dto.seats,
      where: dto.where,
      note: dto.note ?? null,
      memberIds: [userId],
      requestIds: [],
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await Promise.all([
      this.savePod(pod, POD_TTL_SECS),
      this.redis.sadd(podStoreKey(pod.storeId), podId),
      this.redis.setex(userPodKey(userId), POD_TTL_SECS, podId),
    ]);

    return pod;
  }

  async feed(callerId: string) {
    const [storeId, blockedIds] = await Promise.all([
      this.redis.get(presenceKey(callerId)),
      this.safety.getBlockedIds(callerId),
    ]);
    if (!storeId) return [];

    const podIds = await this.redis.smembers(podStoreKey(storeId));
    if (!podIds.length) return [];

    const podResults = await Promise.all(podIds.map((id) => this.getPod(id)));
    const expiredIds: string[] = [];
    const validPods: PodSession[] = [];
    podIds.forEach((id, i) => {
      if (podResults[i]) validPods.push(podResults[i]!);
      else expiredIds.push(id);
    });
    if (expiredIds.length) await this.redis.srem(podStoreKey(storeId), ...expiredIds);
    if (!validPods.length) return [];

    const openPods = validPods.filter((p) => !blockedIds.has(p.hostId));
    if (!openPods.length) return [];

    const hostIds = [...new Set(openPods.map((p) => p.hostId))];
    const [hosts, caller] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: hostIds }, moderationStatus: ModerationStatus.ACTIVE },
        select: { ...PROFILE_SELECT, privacySettings: { select: { discoverable: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: callerId },
        select: { powerLevel: true, formats: true },
      }),
    ]);

    const hostMap = new Map(hosts.map((h) => [h.id, h]));
    const callerPower = caller?.powerLevel ?? null;
    const callerFormats = (caller?.formats ?? []) as string[];

    const results = [];
    for (const pod of openPods) {
      const host = hostMap.get(pod.hostId);
      if (!host || host.privacySettings?.discoverable === false) continue;
      const { privacySettings: _ps, ...hostProfile } = host;
      results.push({
        id: pod.id,
        hostId: pod.hostId,
        storeId: pod.storeId,
        format: pod.format,
        targetPower: pod.targetPower,
        tolerance: pod.tolerance,
        seats: pod.seats,
        seatsOpen: Math.max(0, pod.seats - pod.memberIds.length),
        where: pod.where,
        note: pod.note,
        host: normalizeProfile(hostProfile),
        fit: computeFit(callerPower, callerFormats, pod),
        createdAt: pod.createdAt,
        expiresAt: pod.expiresAt,
      });
    }

    return results;
  }

  async detail(callerId: string, podId: string) {
    const pod = await this.getPod(podId);
    if (!pod) throw new NotFoundException('Pod not found');

    const isHost = callerId === pod.hostId;
    const allUserIds = [...new Set([pod.hostId, ...pod.memberIds])];

    const [caller, allUsers, requestUsers] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: callerId },
        select: { powerLevel: true, formats: true },
      }),
      this.prisma.user.findMany({ where: { id: { in: allUserIds } }, select: PROFILE_SELECT }),
      isHost && pod.requestIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: pod.requestIds } },
            select: PROFILE_SELECT,
          })
        : Promise.resolve(
            [] as Array<{
              id: string;
              displayName: string;
              pronouns: string | null;
              bio: string | null;
              avatarColors: string[];
              commander: string | null;
              powerLevel: number | null;
              vibes: string[];
              formats: string[];
            }>,
          ),
    ]);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const host = userMap.get(pod.hostId);
    if (!host) throw new NotFoundException('Host not found');

    const callerPower = caller?.powerLevel ?? null;
    const callerFormats = (caller?.formats ?? []) as string[];

    const members = pod.memberIds
      .map((id) => userMap.get(id))
      .filter((u): u is NonNullable<typeof u> => u != null)
      .map(normalizeProfile);

    const requests = requestUsers.map(normalizeProfile);

    let candidates: Array<
      ReturnType<typeof normalizeProfile> & { fit: { tier: FitTier; label: string } }
    > = [];
    if (isHost) {
      candidates = await this.getCandidates(callerId, pod);
    }

    return {
      id: pod.id,
      hostId: pod.hostId,
      storeId: pod.storeId,
      format: pod.format,
      targetPower: pod.targetPower,
      tolerance: pod.tolerance,
      seats: pod.seats,
      seatsOpen: Math.max(0, pod.seats - pod.memberIds.length),
      where: pod.where,
      note: pod.note,
      host: normalizeProfile(host),
      fit: computeFit(callerPower, callerFormats, pod),
      members,
      requests,
      candidates,
      hasRequested: !isHost && pod.requestIds.includes(callerId),
      createdAt: pod.createdAt,
      expiresAt: pod.expiresAt,
    };
  }

  private async getCandidates(hostId: string, pod: PodSession) {
    const [blockedIds] = await Promise.all([this.safety.getBlockedIds(hostId)]);
    const excludedIds = new Set([...pod.memberIds, ...pod.requestIds]);

    const rawMembers = await this.redis.zrange(storeMembersKey(pod.storeId), 0, -1);
    const candidateIds = rawMembers.filter(
      (id) => id !== hostId && !excludedIds.has(id) && !blockedIds.has(id),
    );
    if (!candidateIds.length) return [];

    const existsChecks = await Promise.all(
      candidateIds.map((id) => this.redis.exists(presenceKey(id))),
    );
    const presentIds = candidateIds.filter((_, i) => existsChecks[i]);
    if (!presentIds.length) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: presentIds }, moderationStatus: ModerationStatus.ACTIVE },
      select: { ...PROFILE_SELECT, privacySettings: { select: { discoverable: true } } },
    });

    const results: Array<
      ReturnType<typeof normalizeProfile> & { fit: { tier: FitTier; label: string } }
    > = [];
    for (const user of users) {
      if (user.privacySettings?.discoverable === false) continue;
      const { privacySettings: _ps, ...profile } = user;
      results.push({
        ...normalizeProfile(profile),
        fit: computeFit(profile.powerLevel ?? null, profile.formats as string[], pod),
      });
    }

    const tierOrder: Record<FitTier, number> = { great: 0, close: 1, off: 2 };
    results.sort((a, b) => tierOrder[a.fit.tier] - tierOrder[b.fit.tier]);
    return results;
  }

  async request(callerId: string, podId: string) {
    const pod = await this.getPod(podId);
    if (!pod) throw new NotFoundException('Pod not found');
    if (pod.memberIds.includes(callerId)) throw new ConflictException('already_member');
    if (pod.requestIds.includes(callerId)) throw new ConflictException('already_requested');
    if (pod.memberIds.length >= pod.seats) throw new ConflictException('pod_full');

    const updatedPod: PodSession = { ...pod, requestIds: [...pod.requestIds, callerId] };
    await this.savePod(updatedPod, this.remainingSecs(pod));

    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { displayName: true },
    });

    void this.notifications.create(pod.hostId, {
      kind: NotificationKind.POD,
      title: `${caller?.displayName ?? 'Someone'} wants to join your pod`,
      body: 'Tap to manage your pod',
      data: { type: 'pod_join_request', podId, userId: callerId },
    });

    return { success: true };
  }

  async approve(callerId: string, podId: string, dto: PodMemberAction) {
    const pod = await this.getPod(podId);
    if (!pod) throw new NotFoundException('Pod not found');
    if (pod.hostId !== callerId) throw new ForbiddenException('Only the host can approve');
    if (!pod.requestIds.includes(dto.userId)) throw new NotFoundException('User not in requests');
    if (pod.memberIds.length >= pod.seats) throw new ConflictException('pod_full');

    const updatedPod: PodSession = {
      ...pod,
      requestIds: pod.requestIds.filter((id) => id !== dto.userId),
      memberIds: [...pod.memberIds, dto.userId],
    };
    await this.savePod(updatedPod, this.remainingSecs(pod));

    void this.notifications.create(dto.userId, {
      kind: NotificationKind.POD,
      title: "You've been approved for a pod!",
      body: 'Tap to see your pod',
      data: { type: 'pod_approved', podId },
    });

    return { success: true, seatsOpen: Math.max(0, pod.seats - updatedPod.memberIds.length) };
  }

  async decline(callerId: string, podId: string, dto: PodMemberAction) {
    const pod = await this.getPod(podId);
    if (!pod) throw new NotFoundException('Pod not found');
    if (pod.hostId !== callerId) throw new ForbiddenException('Only the host can decline');

    const updatedPod: PodSession = {
      ...pod,
      requestIds: pod.requestIds.filter((id) => id !== dto.userId),
    };
    await this.savePod(updatedPod, this.remainingSecs(pod));
    return { success: true };
  }

  async disband(callerId: string, podId: string) {
    const pod = await this.getPod(podId);
    if (!pod) return;
    if (pod.hostId !== callerId) throw new ForbiddenException('Only the host can disband');
    await this.disbandPod(pod);
  }

  async lock(callerId: string, podId: string) {
    const pod = await this.getPod(podId);
    if (!pod) throw new NotFoundException('Pod not found');
    if (pod.hostId !== callerId) throw new ForbiddenException('Only the host can lock');

    const memberIds = pod.memberIds;
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
          storeId: pod.storeId,
          source: EncounterSource.GAME,
          result: EncounterResult.DRAW,
          notes: 'Pod locked',
        })),
        skipDuplicates: true,
      });
    }

    await this.disbandPod(pod);
    return { success: true };
  }
}
