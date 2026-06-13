import { useMutation } from '@tanstack/react-query';
import type { PlayOnlineInvite } from '@manamap/shared';
import { api } from '../api/client';

export function usePlayOnlineInvite() {
  return useMutation({
    mutationFn: (body: PlayOnlineInvite) =>
      api.post<{ sent: number }>('/v1/play-online/invite', body).then((r) => r.data),
  });
}
