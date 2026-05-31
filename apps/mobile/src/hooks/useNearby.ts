import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttendEventResponse, CheckinResult, NearbyResponse, StoreDetail, StoreEventsResponse, StorePin } from '@manamap/shared';
import { api } from '../api/client';

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

// ---------------------------------------------------------------------------
// Nearby (discovery)
// ---------------------------------------------------------------------------

export function useNearby(enabled = true) {
  return useQuery<NearbyResponse>({
    queryKey: ['discovery', 'nearby'],
    queryFn: () =>
      api.get<NearbyResponse>('/v1/discovery/nearby').then((r) => r.data),
    refetchInterval: POLL_INTERVAL_MS,
    enabled,
  });
}

// ---------------------------------------------------------------------------
// Store search (text query — for store pickers)
// ---------------------------------------------------------------------------

export function useStores(q?: string) {
  return useQuery<Array<{ id: string; name: string; city: string | null; state: string | null }>>({
    queryKey: ['stores', 'search', q ?? ''],
    queryFn: () =>
      api
        .get('/v1/stores', { params: q ? { q } : undefined })
        .then((r) => r.data as Array<{ id: string; name: string; city: string | null; state: string | null }>),
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Store map pins (bbox query)
// ---------------------------------------------------------------------------

export function useStorePins(bbox: string | null) {
  return useQuery<StorePin[]>({
    queryKey: ['stores', 'pins', bbox],
    queryFn: () =>
      api
        .get<StorePin[]>('/v1/stores', { params: { bbox } })
        .then((r) => r.data),
    enabled: !!bbox,
    staleTime: 60 * 1000, // pins are fairly stable
  });
}

// ---------------------------------------------------------------------------
// Store detail
// ---------------------------------------------------------------------------

export function useStoreDetail(storeId: string | null) {
  return useQuery<StoreDetail>({
    queryKey: ['stores', 'detail', storeId],
    queryFn: () =>
      api.get<StoreDetail>(`/v1/stores/${storeId}`).then((r) => r.data),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storeId: string) =>
      api.post<CheckinResult>(`/v1/stores/${storeId}/checkin`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['discovery', 'nearby'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Store events (calendar)
// ---------------------------------------------------------------------------

export function useStoreEvents(storeId: string | null) {
  return useQuery<StoreEventsResponse>({
    queryKey: ['stores', storeId, 'events'],
    queryFn: () =>
      api.get<StoreEventsResponse>(`/v1/stores/${storeId}/events`).then((r) => r.data),
    enabled: !!storeId,
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Attend event (RSVP)
// ---------------------------------------------------------------------------

export function useAttendEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, eventId }: { storeId: string; eventId: string }) =>
      api
        .post<AttendEventResponse>(`/v1/stores/${storeId}/events/${eventId}/attend`)
        .then((r) => r.data),
    onSuccess: (_data, { storeId }) => {
      void qc.invalidateQueries({ queryKey: ['stores', storeId, 'events'] });
    },
  });
}
