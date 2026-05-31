import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export interface StoreOffer {
  id: string;
  type: 'FIRST_VISIT' | 'STREAK';
  title: string;
  description: string | null;
  terms: string | null;
  streakRequired: number | null;
  startsAt: string | null;
  endsAt: string | null;
}

export function useStoreOffers(storeId: string | null) {
  return useQuery<StoreOffer[]>({
    queryKey: ['stores', storeId, 'offers'],
    queryFn: () => api.get(`/v1/stores/${storeId}/offers`).then((r) => r.data),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
}
