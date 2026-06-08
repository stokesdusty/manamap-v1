import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  TrackerState,
  LifeDeltaPayload,
  CommanderDamagePayload,
  CounterDeltaPayload,
  SetTokenPayload,
  EliminatePayload,
  TrackerCounter,
} from '@manamap/shared';
import { getTokens } from '../lib/storage';

const WS_URL = process.env['EXPO_PUBLIC_WS_URL'] ?? 'http://localhost:3001';

export function useLifeTracker(podId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<TrackerState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!podId) return;

    let socket: Socket;

    const connect = async () => {
      const tokens = await getTokens();
      if (!tokens?.accessToken) { setIsLoading(false); return; }

      socket = io(`${WS_URL}/life-tracker`, {
        auth: { token: tokens.accessToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
        socket.emit('join_tracker', { podId });
      });

      socket.on('disconnect', () => setIsConnected(false));

      socket.on('tracker_state', (data: TrackerState | null) => {
        setState(data);
        setIsLoading(false);
      });

      socket.on('connect_error', async (err) => {
        if (err.message === 'auth_failed' || err.message === 'auth_required') {
          const fresh = await getTokens();
          if (fresh?.accessToken) {
            (socket as unknown as { auth: Record<string, string> }).auth = {
              token: fresh.accessToken,
            };
          }
        }
      });
    };

    void connect();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [podId]);

  const emit = useCallback(<T>(event: string, payload?: T) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const actions = useMemo(
    () => ({
      startTracker: (startingLife: number) =>
        emit('start_tracker', { podId, startingLife }),

      lifeDelta: (targetUserId: string, delta: number, note?: string) => {
        // optimistic update
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.userId === targetUserId ? { ...p, life: p.life + delta } : p,
            ),
          };
        });
        const payload: LifeDeltaPayload = { targetUserId, delta, ...(note ? { note } : {}) };
        emit('life_delta', payload);
      },

      commanderDamage: (p: CommanderDamagePayload) => emit('commander_damage', p),

      counterDelta: (targetUserId: string, counter: TrackerCounter, delta: number) => {
        // optimistic update
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.userId === targetUserId
                ? { ...p, [counter]: Math.max(0, p[counter] + delta) }
                : p,
            ),
          };
        });
        const payload: CounterDeltaPayload = { targetUserId, counter, delta };
        emit('counter_delta', payload);
      },

      commanderCast: (userId: string) => emit('commander_cast', { userId }),

      setToken: (p: SetTokenPayload) => emit('set_token', p),

      eliminate: (p: EliminatePayload) => emit('eliminate', p),

      nextTurn: () => emit('next_turn'),

      undo: () => emit('undo'),

      resetGame: () => emit('reset_game'),
    }),
    [emit, podId],
  );

  return { state, isConnected, isLoading, actions };
}
