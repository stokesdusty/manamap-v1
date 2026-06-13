import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateLfg, LfgFeedItem, LfgSession, UpdateLfg } from '@manamap/shared';
import { api } from '../api/client';

const LFG_POLL_INTERVAL = 15_000;

export function useLfgMe() {
  return useQuery<LfgSession | null>({
    queryKey: ['lfg', 'me'],
    queryFn: async () => {
      const { data } = await api.get<LfgSession | null>('/v1/lfg/me');
      return data ?? null;
    },
    refetchInterval: LFG_POLL_INTERVAL,
    staleTime: 10_000,
  });
}

export function useLfgFeed(enabled: boolean) {
  return useQuery<LfgFeedItem[]>({
    queryKey: ['lfg', 'feed'],
    queryFn: async () => {
      const { data } = await api.get<LfgFeedItem[]>('/v1/lfg');
      return data;
    },
    enabled,
    refetchInterval: LFG_POLL_INTERVAL,
    staleTime: 10_000,
  });
}

export function useCreateLfg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLfg) => api.post<LfgSession>('/v1/lfg', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lfg'] }),
  });
}

export function useUpdateLfg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateLfg) => api.patch<LfgSession>('/v1/lfg', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lfg'] }),
  });
}

export function useDeleteLfg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/v1/lfg'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lfg'] }),
  });
}

export function useLfgInvite() {
  return useMutation({
    mutationFn: (hostUserId: string) =>
      api.post(`/v1/lfg/${hostUserId}/invite`).then((r) => r.data),
  });
}

export function useLfgLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ hostUserId, memberIds }: { hostUserId: string; memberIds: string[] }) =>
      api.post(`/v1/lfg/${hostUserId}/lock`, { memberIds }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lfg'] });
      qc.invalidateQueries({ queryKey: ['encounters'] });
    },
  });
}
