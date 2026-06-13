import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Rivalry } from '@manamap/shared';

export function useRivalries(limit = 10) {
  return useQuery<Rivalry[]>({
    queryKey: ['rivalries', limit],
    queryFn: () => api.get('/v1/me/rivalries', { params: { limit } }).then((r) => r.data),
    staleTime: 60 * 1000,
  });
}

export function useRivalryDetail(opponentId: string | undefined) {
  return useQuery<Rivalry | null>({
    queryKey: ['rivalries', 'detail', opponentId],
    queryFn: () =>
      api.get<Rivalry | null>(`/v1/rivalries/${opponentId}`).then((r) => r.data),
    enabled: !!opponentId,
    staleTime: 60 * 1000,
  });
}
