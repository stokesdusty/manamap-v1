import { useMutation, useQuery } from '@tanstack/react-query';
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

export interface ClaimResult {
  code: string;
  offerId: string;
  offerTitle: string;
  status: 'PENDING' | 'REDEEMED' | 'VOID';
}

export function useClaimOffer() {
  return useMutation<ClaimResult, Error, { offerId: string }>({
    mutationFn: ({ offerId }) =>
      api.post<ClaimResult>(`/v1/offers/${offerId}/claim`).then((r) => r.data),
  });
}

export function useRedemptionStatus(offerId: string | null, enabled: boolean) {
  return useQuery<ClaimResult | null>({
    queryKey: ['redemption-status', offerId],
    queryFn: () =>
      api
        .get<ClaimResult>(`/v1/offers/${offerId}/my-redemption`)
        .then((r) => r.data)
        .catch((err: { response?: { status: number } }) => {
          if (err?.response?.status === 404) return null;
          throw err;
        }),
    enabled: !!offerId && enabled,
    refetchInterval: (query) => (query.state.data?.status === 'REDEEMED' ? false : 5000),
    refetchOnWindowFocus: true,
  });
}
