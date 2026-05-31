import { useQuery } from '@tanstack/react-query';
import type { EncountersResponse } from '@manamap/shared';
import { api } from '../api/client';

export function useEncounters() {
  return useQuery<EncountersResponse>({
    queryKey: ['encounters'],
    queryFn: () => api.get<EncountersResponse>('/v1/encounters').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCrossedPathsCount() {
  const { data } = useEncounters();
  return data?.crossedPathsCount ?? 0;
}
