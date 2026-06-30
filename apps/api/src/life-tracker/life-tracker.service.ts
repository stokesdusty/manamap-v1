import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import type {
  TrackerState,
  TrackerPlayer,
  LifeDeltaPayload,
  CommanderDamagePayload,
  CounterDeltaPayload,
  SetTokenPayload,
  EliminatePayload,
} from '@manamap/shared';
import { REDIS } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';
import type { PodSession } from '../pods/pods.service';

const TRACKER_TTL_SECS = 8 * 60 * 60;
const MAX_HISTORY = 20;

interface TrackerStateInternal extends TrackerState {
  memberIds: string[];
  history: TrackerState[];
}

const trackerKey = (podId: string) => `life_tracker:${podId}`;

@Injectable()
export class LifeTrackerService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  private async getInternal(podId: string): Promise<TrackerStateInternal | null> {
    const raw = await this.redis.get(trackerKey(podId));
    if (!raw) return null;
    return JSON.parse(raw) as TrackerStateInternal;
  }

  private async saveInternal(state: TrackerStateInternal): Promise<void> {
    await this.redis.setex(trackerKey(state.podId), TRACKER_TTL_SECS, JSON.stringify(state));
  }

  private strip(state: TrackerStateInternal): TrackerState {
    const { memberIds: _m, history: _h, ...pub } = state;
    void _m;
    void _h;
    return pub;
  }

  private checkKill(player: TrackerPlayer): TrackerPlayer {
    if (player.isEliminated) return player;
    const cmdKill = Object.values(player.commanderDamage).some((d) => d >= 21);
    if (player.life <= 0 || player.poison >= 10 || cmdKill) {
      return { ...player, isEliminated: true };
    }
    return player;
  }

  private snapshot(state: TrackerStateInternal): TrackerState[] {
    const snap = this.strip(state);
    const history = [...state.history, snap];
    return history.length > MAX_HISTORY ? history.slice(-MAX_HISTORY) : history;
  }

  private nextAlive(state: TrackerStateInternal, currentIdx: number): string | null {
    const { players } = state;
    if (!players.length) return null;
    for (let i = 1; i <= players.length; i++) {
      const p = players[(currentIdx + i) % players.length];
      if (p && !p.isEliminated) return p.userId;
    }
    return null;
  }

  async getMemberIds(podId: string): Promise<string[] | null> {
    const s = await this.getInternal(podId);
    return s?.memberIds ?? null;
  }

  async getState(podId: string): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    return s ? this.strip(s) : null;
  }

  async createState(podId: string, pod: PodSession, startingLife: number): Promise<TrackerState> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: pod.memberIds } },
      select: { id: true, displayName: true, avatarColors: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const players: TrackerPlayer[] = pod.memberIds.map((userId) => {
      const user = userMap.get(userId);
      const commanderDamage: Record<string, number> = {};
      pod.memberIds
        .filter((id) => id !== userId)
        .forEach((id) => {
          commanderDamage[id] = 0;
        });
      return {
        userId,
        displayName: user?.displayName ?? 'Unknown',
        avatarColors: (user?.avatarColors ?? []) as string[],
        life: startingLife,
        poison: 0,
        energy: 0,
        experience: 0,
        commanderDamage,
        commanderCastCount: 0,
        isEliminated: false,
        hasCitysBlessing: false,
      };
    });

    const internal: TrackerStateInternal = {
      podId,
      format: pod.format,
      startingLife,
      turnNumber: 1,
      activePlayerId: pod.memberIds[0] ?? null,
      monarchId: null,
      initiativeId: null,
      players,
      createdAt: new Date().toISOString(),
      memberIds: [...pod.memberIds],
      history: [],
    };

    await this.saveInternal(internal);
    return this.strip(internal);
  }

  async applyLifeDelta(podId: string, payload: LifeDeltaPayload): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    if (!s) return null;

    const history = this.snapshot(s);
    const players = s.players.map((p) => {
      if (p.userId !== payload.targetUserId) return p;
      return this.checkKill({ ...p, life: p.life + payload.delta });
    });

    const next: TrackerStateInternal = { ...s, players, history };
    await this.saveInternal(next);
    return this.strip(next);
  }

  async applyCommanderDamage(
    podId: string,
    payload: CommanderDamagePayload,
  ): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    if (!s) return null;

    const history = this.snapshot(s);
    const players = s.players.map((p) => {
      if (p.userId !== payload.targetUserId) return p;
      const prev = p.commanderDamage[payload.sourceUserId] ?? 0;
      const newCmdDmg = Math.max(0, prev + payload.delta);
      return this.checkKill({
        ...p,
        life: p.life - payload.delta,
        commanderDamage: { ...p.commanderDamage, [payload.sourceUserId]: newCmdDmg },
      });
    });

    const next: TrackerStateInternal = { ...s, players, history };
    await this.saveInternal(next);
    return this.strip(next);
  }

  async applyCounterDelta(
    podId: string,
    payload: CounterDeltaPayload,
  ): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    if (!s) return null;

    const history = this.snapshot(s);
    const players = s.players.map((p) => {
      if (p.userId !== payload.targetUserId) return p;
      const updated = { ...p, [payload.counter]: Math.max(0, p[payload.counter] + payload.delta) };
      return this.checkKill(updated);
    });

    const next: TrackerStateInternal = { ...s, players, history };
    await this.saveInternal(next);
    return this.strip(next);
  }

  async applyCommanderCast(podId: string, userId: string): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    if (!s) return null;

    const history = this.snapshot(s);
    const players = s.players.map((p) =>
      p.userId === userId ? { ...p, commanderCastCount: p.commanderCastCount + 1 } : p,
    );

    const next: TrackerStateInternal = { ...s, players, history };
    await this.saveInternal(next);
    return this.strip(next);
  }

  async setToken(podId: string, payload: SetTokenPayload): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    if (!s) return null;

    const history = this.snapshot(s);
    let players = s.players;
    let patch: Partial<TrackerStateInternal> = {};

    if (payload.token === 'monarch') {
      patch = { monarchId: payload.userId };
    } else if (payload.token === 'initiative') {
      patch = { initiativeId: payload.userId };
    } else {
      players = s.players.map((p) => ({
        ...p,
        hasCitysBlessing: p.userId === payload.userId ? !p.hasCitysBlessing : p.hasCitysBlessing,
      }));
    }

    const next: TrackerStateInternal = { ...s, ...patch, players, history };
    await this.saveInternal(next);
    return this.strip(next);
  }

  async setEliminated(podId: string, payload: EliminatePayload): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    if (!s) return null;

    const history = this.snapshot(s);
    const players = s.players.map((p) =>
      p.userId === payload.userId ? { ...p, isEliminated: payload.eliminated } : p,
    );

    const next: TrackerStateInternal = { ...s, players, history };
    await this.saveInternal(next);
    return this.strip(next);
  }

  async nextTurn(podId: string): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    if (!s) return null;

    const history = this.snapshot(s);
    const currentIdx = s.activePlayerId
      ? s.players.findIndex((p) => p.userId === s.activePlayerId)
      : -1;
    const activePlayerId = this.nextAlive(s, Math.max(currentIdx, 0));

    const next: TrackerStateInternal = {
      ...s,
      turnNumber: s.turnNumber + 1,
      activePlayerId,
      history,
    };
    await this.saveInternal(next);
    return this.strip(next);
  }

  async undo(podId: string): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    if (!s) return null;
    if (!s.history.length) return this.strip(s);

    const prev = s.history[s.history.length - 1]!;
    const next: TrackerStateInternal = {
      ...prev,
      memberIds: s.memberIds,
      history: s.history.slice(0, -1),
    };
    await this.saveInternal(next);
    return this.strip(next);
  }

  async resetGame(podId: string): Promise<TrackerState | null> {
    const s = await this.getInternal(podId);
    if (!s) return null;

    const players = s.players.map((p) => ({
      ...p,
      life: s.startingLife,
      poison: 0,
      energy: 0,
      experience: 0,
      commanderDamage: Object.fromEntries(Object.keys(p.commanderDamage).map((k) => [k, 0])),
      commanderCastCount: 0,
      isEliminated: false,
      hasCitysBlessing: false,
    }));

    const next: TrackerStateInternal = {
      ...s,
      turnNumber: 1,
      activePlayerId: s.memberIds[0] ?? null,
      monarchId: null,
      initiativeId: null,
      players,
      history: [],
    };
    await this.saveInternal(next);
    return this.strip(next);
  }
}
