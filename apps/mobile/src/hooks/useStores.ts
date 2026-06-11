import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ConfirmStore, SuggestStore } from '@manamap/shared';
import { api } from '../api/client';

export function useSuggestStore() {
  return useMutation({
    mutationFn: (body: SuggestStore) =>
      api
        .post<{ id: string; name: string; status: string }>('/v1/stores/suggest', body)
        .then((r) => r.data),
  });
}

export function useConfirmStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, body }: { storeId: string; body: ConfirmStore }) =>
      api
        .post<{ confirmationCount: number; status: string }>(`/v1/stores/${storeId}/confirm`, body)
        .then((r) => r.data),
    onSuccess: (data) => {
      if (data.status === 'ACTIVE') {
        void qc.invalidateQueries({ queryKey: ['stores', 'pins'] });
      }
    },
  });
}
