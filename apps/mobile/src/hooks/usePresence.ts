import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import type { HeartbeatBody, HeartbeatResponse } from '@manamap/shared';
import { api } from '../api/client';
import { useActiveStore } from '../context/ActiveStoreContext';

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes (TTL is 5 min)

async function buildHeartbeatBody(storeId?: string): Promise<HeartbeatBody> {
  const body: HeartbeatBody = {};
  if (storeId) body.storeId = storeId;

  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      // Use cached position — fast and sufficient for presence/map purposes
      const pos = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
      if (pos) {
        body.lat = pos.coords.latitude;
        body.lng = pos.coords.longitude;
      }
    }
  } catch { /* location unavailable — heartbeat still fires without coords */ }

  return body;
}

function sendHeartbeat(body: HeartbeatBody) {
  return api
    .post<HeartbeatResponse>('/v1/presence/heartbeat', body)
    .then((r) => r.data);
}

export function useCheckout() {
  const { setActiveStore } = useActiveStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/v1/presence/checkin').then((r) => r.data),
    onSuccess: () => {
      setActiveStore(null);
      void qc.invalidateQueries({ queryKey: ['nearby'] });
    },
  });
}

/**
 * Sends periodic presence heartbeats while the app is foregrounded.
 * Always fires (not gated on store check-in) so the server always has
 * a fresh last-known location. Includes storeId when the user is
 * checked in to a store.
 */
export function usePresence() {
  const { activeStore } = useActiveStore();
  const { mutate } = useMutation({
    mutationFn: (body: HeartbeatBody) => sendHeartbeat(body),
  });

  const activeStoreRef = useRef(activeStore);
  activeStoreRef.current = activeStore;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  function fire() {
    void buildHeartbeatBody(activeStoreRef.current?.id).then((body) => mutate(body));
  }

  function startHeartbeat() {
    if (intervalRef.current) return;
    fire();
    intervalRef.current = setInterval(fire, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // Restart when the active store changes while foregrounded so the new
  // storeId is sent immediately rather than waiting for the next tick.
  useEffect(() => {
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

    if (AppState.currentState === 'active') {
      startHeartbeat();
    }

    return () => {
      sub.remove();
      stopHeartbeat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
