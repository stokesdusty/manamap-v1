import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ActiveQuest } from '@manamap/shared';

export function useQuests() {
  return useQuery<ActiveQuest[]>({
    queryKey: ['quests'],
    queryFn: () => api.get('/v1/quests').then((r) => r.data),
    staleTime: 60 * 1000,
  });
}
