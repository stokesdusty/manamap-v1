import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EndorsementTag } from '@manamap/shared';
import { api } from '../api/client';

export function useEndorse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      gameLogId,
      toUserId,
      tag,
    }: {
      gameLogId: string;
      toUserId: string;
      tag: EndorsementTag;
    }) =>
      api
        .post<{ success: boolean }>(`/v1/games/${gameLogId}/endorse`, { toUserId, tag })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}
