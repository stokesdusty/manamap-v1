import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import type { HeartbeatResponse } from '@manamap/shared';
import { api } from '../api/client';
import { useActiveStore } from '../context/ActiveStoreContext';

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes (TTL is 5 min)

function sendHeartbeat(storeId: string) {
  return api
    .post<HeartbeatResponse>('/v1/presence/heartbeat', { storeId })
    .then((r) => r.data);
}

/**
 * Sends periodic presence heartbeats for the active store from context while
 * the app is foregrounded. Stops when backgrounded and resumes on foreground.
 * No-ops when no store is active.
 */
export function usePresence() {
  const { activeStore } = useActiveStore();
  const { mutate } = useMutation({
    mutationFn: (id: string) => sendHeartbeat(id),
  });

  const activeStoreRef = useRef(activeStore);
  activeStoreRef.current = activeStore;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  function startHeartbeat() {
    if (intervalRef.current) return;
    if (!activeStoreRef.current) return;

    mutate(activeStoreRef.current.id);
    intervalRef.current = setInterval(() => {
      if (activeStoreRef.current) mutate(activeStoreRef.current.id);
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // Restart when the active store changes while foregrounded
  useEffect(() => {
    if (!activeStore) {
      stopHeartbeat();
      return;
    }
    if (appStateRef.current === 'active') {
      stopHeartbeat();
      startHeartbeat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'active' && prev !== 'active') {
        startHeartbeat();
      } else if (next !== 'active') {
        stopHeartbeat();
      }
    });

    if (AppState.currentState === 'active' && activeStore) {
      startHeartbeat();
    }

    return () => {
      sub.remove();
      stopHeartbeat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
