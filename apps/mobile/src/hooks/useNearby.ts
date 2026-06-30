import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssociateCheckinEventBody,
  AttendEventResponse,
  CheckinResult,
  EventAttendanceResponse,
  ManaColor,
  MtgFormat,
  NearbyResponse,
  NotifyWhenActiveResponse,
  PlayerVibe,
  StoreDetail,
  StoreEventsResponse,
  StorePin,
  SuggestionsResponse,
  UnattendEventResponse,
} from '@manamap/shared';
import { api } from '../api/client';

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

// ---------------------------------------------------------------------------
// Nearby (discovery)
// ---------------------------------------------------------------------------

export interface DiscoveryFilters {
  format?: MtgFormat;
  colors?: ManaColor[];
  powerMin?: number;
  powerMax?: number;
  vibe?: PlayerVibe;
}

export function useNearby(enabled = true, filters?: DiscoveryFilters) {
  return useQuery<NearbyResponse>({
    queryKey: ['discovery', 'nearby', filters ?? null],
    queryFn: () => {
      const params: Record<string, string | number> = {};
      if (filters?.format) params.format = filters.format;
      if (filters?.colors?.length) params.colors = filters.colors.join(',');
      if (filters?.powerMin != null) params.powerMin = filters.powerMin;
      if (filters?.powerMax != null) params.powerMax = filters.powerMax;
      if (filters?.vibe) params.vibe = filters.vibe;
      return api.get<NearbyResponse>('/v1/discovery/nearby', { params }).then((r) => r.data);
    },
    refetchInterval: POLL_INTERVAL_MS,
    enabled,
  });
}

// ---------------------------------------------------------------------------
// Suggestions (matchmaking)
// ---------------------------------------------------------------------------

export function useSuggestions(enabled = true) {
  return useQuery<SuggestionsResponse>({
    queryKey: ['discovery', 'suggestions'],
    queryFn: () => api.get<SuggestionsResponse>('/v1/discovery/suggestions').then((r) => r.data),
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
        .then(
          (r) =>
            r.data as Array<{
              id: string;
              name: string;
              city: string | null;
              state: string | null;
            }>,
        ),
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
        .get<StorePin[]>('/v1/stores', { params: { bbox, includeProposed: 'true' } })
        .then((r) => r.data),
    enabled: !!bbox,
    staleTime: 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Store detail
// ---------------------------------------------------------------------------

export function useStoreDetail(storeId: string | null) {
  return useQuery<StoreDetail>({
    queryKey: ['stores', 'detail', storeId],
    queryFn: () => api.get<StoreDetail>(`/v1/stores/${storeId}`).then((r) => r.data),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export interface CheckinArgs {
  storeId: string;
  lat: number;
  lng: number;
  accuracy?: number;
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, lat, lng, accuracy }: CheckinArgs) =>
      api
        .post<CheckinResult>(`/v1/stores/${storeId}/checkin`, { lat, lng, accuracy })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['discovery', 'nearby'] });
      void qc.invalidateQueries({ queryKey: ['discovery', 'suggestions'] });
      void qc.invalidateQueries({ queryKey: ['quests'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Notify when active (one-shot presence-threshold subscription)
// ---------------------------------------------------------------------------

export function useNotifyWhenActive() {
  return useMutation({
    mutationFn: ({ storeId, threshold = 2 }: { storeId: string; threshold?: number }) =>
      api
        .post<NotifyWhenActiveResponse>(`/v1/stores/${storeId}/notify-when-active`, { threshold })
        .then((r) => r.data),
  });
}

// ---------------------------------------------------------------------------
// Store events (calendar)
// ---------------------------------------------------------------------------

export function useStoreEvents(storeId: string | null) {
  return useQuery<StoreEventsResponse>({
    queryKey: ['stores', storeId, 'events'],
    queryFn: () => api.get<StoreEventsResponse>(`/v1/stores/${storeId}/events`).then((r) => r.data),
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

// ---------------------------------------------------------------------------
// Un-attend event (cancel RSVP)
// ---------------------------------------------------------------------------

export function useUnattendEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, eventId }: { storeId: string; eventId: string }) =>
      api
        .delete<UnattendEventResponse>(`/v1/stores/${storeId}/events/${eventId}/attend`)
        .then((r) => r.data),
    onSuccess: (_data, { storeId }) => {
      void qc.invalidateQueries({ queryKey: ['stores', storeId, 'events'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Associate check-in with an active event
// ---------------------------------------------------------------------------

export function useAssociateCheckinEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      storeId,
      checkinId,
      eventId,
    }: {
      storeId: string;
      checkinId: string;
      eventId: string;
    }) =>
      api
        .post<AssociateCheckinEventBody>(`/v1/stores/${storeId}/checkin/${checkinId}/event`, {
          eventId,
        })
        .then((r) => r.data),
    onSuccess: (_data, { storeId }) => {
      void qc.invalidateQueries({ queryKey: ['stores', storeId, 'events'] });
      void qc.invalidateQueries({ queryKey: ['stores', storeId, 'eventAttendance'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Event attendance roster (here now + RSVP'd)
// ---------------------------------------------------------------------------

export function useEventAttendance(storeId: string | null, eventId: string | null) {
  return useQuery<EventAttendanceResponse>({
    queryKey: ['stores', storeId, 'eventAttendance', eventId],
    queryFn: () =>
      api
        .get<EventAttendanceResponse>(`/v1/stores/${storeId}/events/${eventId}/attendance`)
        .then((r) => r.data),
    enabled: !!storeId && !!eventId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}
