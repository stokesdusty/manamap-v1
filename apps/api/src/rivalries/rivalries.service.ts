import { Injectable } from '@nestjs/common';
import { EncounterResult, EncounterSource, ModerationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafetyService } from '../safety/safety.service';

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

type Stats = {
  gameIds: Set<string>;
  recentGameIds: Set<string>;
  wins: number;
  losses: number;
  lastAt: Date;
};

@Injectable()
export class RivalriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
  ) {}

  private async aggregate(userId: string, opponentId?: string): Promise<Map<string, Stats>> {
    const encounters = await this.prisma.encounter.findMany({
      where: {
        userId,
        source: EncounterSource.GAME,
        gameId: { not: null },
        ...(opponentId ? { opponentId } : {}),
      },
      select: { opponentId: true, result: true, gameId: true, createdAt: true },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const map = new Map<string, Stats>();

    for (const e of encounters) {
      let entry = map.get(e.opponentId);
      if (!entry) {
        entry = { gameIds: new Set(), recentGameIds: new Set(), wins: 0, losses: 0, lastAt: e.createdAt };
        map.set(e.opponentId, entry);
      }
      if (e.gameId) {
        entry.gameIds.add(e.gameId);
        if (e.createdAt >= thirtyDaysAgo) entry.recentGameIds.add(e.gameId);
      }
      if (e.result === EncounterResult.WIN) entry.wins++;
      else if (e.result === EncounterResult.LOSS) entry.losses++;
      if (e.createdAt > entry.lastAt) entry.lastAt = e.createdAt;
    }

    return map;
  }

  private shape(opp: { id: string; displayName: string; pronouns: string | null; bio: string | null; avatarColors: string[]; commander: string | null; powerLevel: number | null; vibes: string[]; formats: string[] }, stats: Stats) {
    return {
      opponentId: opp.id,
      displayName: opp.displayName,
      pronouns: opp.pronouns,
      bio: opp.bio,
      avatarColors: opp.avatarColors,
      commander: opp.commander,
      powerLevel: opp.powerLevel,
      vibes: opp.vibes ?? [],
      formats: opp.formats,
      gamesTogether: stats.gameIds.size,
      wins: stats.wins,
      losses: stats.losses,
      record: `${stats.wins}–${stats.losses}`,
      lastPlayedAt: stats.lastAt.toISOString(),
      hot: stats.recentGameIds.size >= 3,
    };
  }

  async getMyRivalries(userId: string, limit = 10) {
    const [blockedIds, map] = await Promise.all([
      this.safety.getBlockedIds(userId),
      this.aggregate(userId),
    ]);

    const candidateIds = [...map.keys()].filter((id) => !blockedIds.has(id));

    const opponents = await this.prisma.user.findMany({
      where: { id: { in: candidateIds }, moderationStatus: ModerationStatus.ACTIVE },
      select: PROFILE_SELECT,
    });

    const results = opponents.map((opp) => this.shape(opp, map.get(opp.id)!));

    results.sort((a, b) => {
      if (b.gamesTogether !== a.gamesTogether) return b.gamesTogether - a.gamesTogether;
      return new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime();
    });

    return results.slice(0, Math.min(limit, 20));
  }

  async getRivalryDetail(userId: string, opponentId: string) {
    const [blockedIds, map] = await Promise.all([
      this.safety.getBlockedIds(userId),
      this.aggregate(userId, opponentId),
    ]);

    if (blockedIds.has(opponentId)) return null;

    const stats = map.get(opponentId);
    if (!stats || stats.gameIds.size === 0) return null;

    const opponent = await this.prisma.user.findFirst({
      where: { id: opponentId, moderationStatus: ModerationStatus.ACTIVE },
      select: PROFILE_SELECT,
    });
    if (!opponent) return null;

    return this.shape(opponent, stats);
  }
}
