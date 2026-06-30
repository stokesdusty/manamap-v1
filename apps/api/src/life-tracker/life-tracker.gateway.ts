import type { OnGatewayInit, OnGatewayDisconnect } from '@nestjs/websockets';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';
import type {
  TrackerState,
  LifeDeltaPayload,
  CommanderDamagePayload,
  CounterDeltaPayload,
  SetTokenPayload,
  EliminatePayload,
} from '@manamap/shared';
import { REDIS } from '../redis/redis.module';
import { LifeTrackerService } from './life-tracker.service';
import type { PodSession } from '../pods/pods.service';

@WebSocketGateway({
  namespace: '/life-tracker',
  port: 3001,
  cors: { origin: '*' },
})
export class LifeTrackerGateway implements OnGatewayInit<Server>, OnGatewayDisconnect {
  @WebSocketServer() private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly service: LifeTrackerService,
  ) {}

  afterInit(server: Server): void {
    server.use((socket, next) => {
      const token = socket.handshake.auth?.['token'] as string | undefined;
      if (!token) {
        next(new Error('auth_required'));
        return;
      }
      try {
        const payload = this.jwtService.verify<{ sub: string }>(token);
        socket.data['userId'] = payload.sub;
        next();
      } catch {
        next(new Error('auth_failed'));
      }
    });
  }

  handleDisconnect(_socket: Socket): void {}

  private room(podId: string) {
    return `pod:${podId}`;
  }

  private getPodId(socket: Socket): string | null {
    for (const room of socket.rooms) {
      if (room.startsWith('pod:')) return room.slice(4);
    }
    return null;
  }

  private broadcast(podId: string, state: TrackerState | null): void {
    if (!state) return;
    this.server.to(this.room(podId)).emit('tracker_state', state);
  }

  @SubscribeMessage('join_tracker')
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { podId: string },
  ): Promise<void> {
    const userId: string = socket.data['userId'];
    const podId = data?.podId;
    if (!userId || !podId) return;

    const raw = await this.redis.get(`pod:${podId}`);
    const pod = raw ? (JSON.parse(raw) as PodSession) : null;
    const trackerMemberIds = pod ? null : await this.service.getMemberIds(podId);
    const memberIds = pod?.memberIds ?? trackerMemberIds ?? [];

    if (!memberIds.includes(userId)) {
      socket.emit('tracker_error', { code: 'not_member', message: 'Not a pod member' });
      return;
    }

    await socket.join(this.room(podId));
    const state = await this.service.getState(podId);
    socket.emit('tracker_state', state);
  }

  @SubscribeMessage('start_tracker')
  async onStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { podId: string; startingLife?: number },
  ): Promise<void> {
    const userId: string = socket.data['userId'];
    const podId = data?.podId;
    if (!userId || !podId) return;

    const raw = await this.redis.get(`pod:${podId}`);
    if (!raw) {
      socket.emit('tracker_error', { code: 'pod_not_found', message: 'Pod not found' });
      return;
    }
    const pod = JSON.parse(raw) as PodSession;

    if (!pod.memberIds.includes(userId)) {
      socket.emit('tracker_error', { code: 'not_member', message: 'Not a pod member' });
      return;
    }

    const existing = await this.service.getState(podId);
    if (existing) {
      this.broadcast(podId, existing);
      return;
    }

    const life = data.startingLife ?? (pod.format === 'commander' ? 40 : 20);
    const state = await this.service.createState(podId, pod, life);
    this.broadcast(podId, state);
  }

  @SubscribeMessage('life_delta')
  async onLifeDelta(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: LifeDeltaPayload,
  ): Promise<void> {
    const podId = this.getPodId(socket);
    if (!podId) return;
    const state = await this.service.applyLifeDelta(podId, payload);
    this.broadcast(podId, state);
  }

  @SubscribeMessage('commander_damage')
  async onCommanderDamage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CommanderDamagePayload,
  ): Promise<void> {
    const podId = this.getPodId(socket);
    if (!podId) return;
    const state = await this.service.applyCommanderDamage(podId, payload);
    this.broadcast(podId, state);
  }

  @SubscribeMessage('counter_delta')
  async onCounterDelta(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CounterDeltaPayload,
  ): Promise<void> {
    const podId = this.getPodId(socket);
    if (!podId) return;
    const state = await this.service.applyCounterDelta(podId, payload);
    this.broadcast(podId, state);
  }

  @SubscribeMessage('commander_cast')
  async onCommanderCast(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { userId: string },
  ): Promise<void> {
    const podId = this.getPodId(socket);
    if (!podId || !data?.userId) return;
    const state = await this.service.applyCommanderCast(podId, data.userId);
    this.broadcast(podId, state);
  }

  @SubscribeMessage('set_token')
  async onSetToken(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: SetTokenPayload,
  ): Promise<void> {
    const podId = this.getPodId(socket);
    if (!podId) return;
    const state = await this.service.setToken(podId, payload);
    this.broadcast(podId, state);
  }

  @SubscribeMessage('eliminate')
  async onEliminate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: EliminatePayload,
  ): Promise<void> {
    const podId = this.getPodId(socket);
    if (!podId) return;
    const state = await this.service.setEliminated(podId, payload);
    this.broadcast(podId, state);
  }

  @SubscribeMessage('next_turn')
  async onNextTurn(@ConnectedSocket() socket: Socket): Promise<void> {
    const podId = this.getPodId(socket);
    if (!podId) return;
    const state = await this.service.nextTurn(podId);
    this.broadcast(podId, state);
  }

  @SubscribeMessage('undo')
  async onUndo(@ConnectedSocket() socket: Socket): Promise<void> {
    const podId = this.getPodId(socket);
    if (!podId) return;
    const state = await this.service.undo(podId);
    this.broadcast(podId, state);
  }

  @SubscribeMessage('reset_game')
  async onReset(@ConnectedSocket() socket: Socket): Promise<void> {
    const podId = this.getPodId(socket);
    if (!podId) return;
    const state = await this.service.resetGame(podId);
    this.broadcast(podId, state);
  }
}
