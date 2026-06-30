import { Injectable } from '@nestjs/common';
import { ConnectionStatus, GameStatus, NotificationKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export type QuestCriteria =
  | { type: 'meet_new_players'; count: number }
  | { type: 'new_store' }
  | { type: 'play_games'; count: number }
  | { type: 'checkin_streak'; length: number }
  | { type: 'unique_stores'; count: number };

@Injectable()
export class QuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getActiveQuests(userId: string) {
    const now = new Date();
    const quests = await this.prisma.quest.findMany({
      where: { activeFrom: { lte: now }, activeTo: { gt: now } },
      include: {
        rewardBadge: { select: { id: true, code: true, name: true, icon: true } },
      },
      orderBy: { activeFrom: 'asc' },
    });

    if (!quests.length) return [];

    const progresses = await this.prisma.questProgress.findMany({
      where: { userId, questId: { in: quests.map((q) => q.id) } },
    });
    const progressMap = new Map(progresses.map((p) => [p.questId, p]));

    return quests.map((q) => {
      const criteria = q.criteria as QuestCriteria;
      const goal = this.getGoal(criteria);
      const prog = progressMap.get(q.id);
      return {
        quest: {
          id: q.id,
          code: q.code,
          title: q.title,
          description: q.description ?? null,
          icon: q.icon,
          period: q.period,
          activeFrom: q.activeFrom.toISOString(),
          activeTo: q.activeTo.toISOString(),
          rewardBadge: q.rewardBadge ?? null,
        },
        progress: prog?.progress ?? 0,
        goal,
        completed: prog?.completedAt != null,
      };
    });
  }

  async evaluate(userId: string): Promise<void> {
    const now = new Date();
    const quests = await this.prisma.quest.findMany({
      where: { activeFrom: { lte: now }, activeTo: { gt: now } },
      include: { rewardBadge: true },
    });
    if (!quests.length) return;

    const progresses = await this.prisma.questProgress.findMany({
      where: { userId, questId: { in: quests.map((q) => q.id) } },
    });
    const progressMap = new Map(progresses.map((p) => [p.questId, p]));

    const pending = quests.filter((q) => !progressMap.get(q.id)?.completedAt);
    if (!pending.length) return;

    for (const quest of pending) {
      const criteria = quest.criteria as QuestCriteria;
      const goal = this.getGoal(criteria);
      const progress = await this.computeProgress(userId, criteria, quest.activeFrom);

      const existing = progressMap.get(quest.id);
      const isNowComplete = progress >= goal;

      if (!existing) {
        await this.prisma.questProgress.create({
          data: {
            userId,
            questId: quest.id,
            progress,
            ...(isNowComplete ? { completedAt: now } : {}),
          },
        });
      } else {
        await this.prisma.questProgress.update({
          where: { id: existing.id },
          data: {
            progress,
            ...(isNowComplete ? { completedAt: now } : {}),
          },
        });
      }

      if (isNowComplete) {
        if (quest.rewardBadge) {
          try {
            await this.prisma.userBadge.create({
              data: { userId, badgeId: quest.rewardBadge.id },
            });
          } catch {
            // Already earned — race or re-run
          }
        }

        void this.notifications.create(userId, {
          kind: NotificationKind.QUEST,
          title: `Quest complete: ${quest.title}`,
          body: quest.rewardBadge
            ? `You earned the ${quest.rewardBadge.icon} ${quest.rewardBadge.name} badge!`
            : 'Great work this month!',
          data: { type: 'quest_complete', questId: quest.id },
        });
      }
    }
  }

  private getGoal(criteria: QuestCriteria): number {
    switch (criteria.type) {
      case 'meet_new_players':
        return criteria.count;
      case 'new_store':
        return 1;
      case 'play_games':
        return criteria.count;
      case 'checkin_streak':
        return criteria.length;
      case 'unique_stores':
        return criteria.count;
    }
  }

  private async computeProgress(
    userId: string,
    criteria: QuestCriteria,
    since: Date,
  ): Promise<number> {
    switch (criteria.type) {
      case 'meet_new_players': {
        return this.prisma.connection.count({
          where: {
            OR: [{ requesterId: userId }, { addresseeId: userId }],
            status: ConnectionStatus.ACCEPTED,
            updatedAt: { gte: since },
          },
        });
      }

      case 'new_store': {
        const newCheckins = await this.prisma.checkin.findMany({
          where: { userId, checkedInAt: { gte: since } },
          select: { storeId: true },
          distinct: ['storeId'],
        });
        if (!newCheckins.length) return 0;

        const storeIds = newCheckins.map((c) => c.storeId);
        const priorVisits = await this.prisma.checkin.findMany({
          where: { userId, storeId: { in: storeIds }, checkedInAt: { lt: since } },
          select: { storeId: true },
          distinct: ['storeId'],
        });
        const priorSet = new Set(priorVisits.map((c) => c.storeId));
        const genuinelyNew = storeIds.filter((id) => !priorSet.has(id));
        return genuinelyNew.length > 0 ? 1 : 0;
      }

      case 'play_games': {
        return this.prisma.gameLog.count({
          where: {
            status: GameStatus.CONFIRMED,
            confirmedAt: { gte: since },
            players: { some: { userId } },
          },
        });
      }

      case 'checkin_streak': {
        const best = await this.prisma.streak.findFirst({
          where: { userId },
          orderBy: { currentStreak: 'desc' },
          select: { currentStreak: true },
        });
        return best?.currentStreak ?? 0;
      }

      case 'unique_stores': {
        const groups = await this.prisma.checkin.groupBy({
          by: ['storeId'],
          where: { userId, checkedInAt: { gte: since } },
        });
        return groups.length;
      }
    }
  }
}
