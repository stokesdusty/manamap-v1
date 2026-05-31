import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BlockBody, BlockedUser, ReportBody } from '@manamap/shared';
import { api } from '../api/client';

const KEYS = {
  blocked: ['safety', 'blocked'] as const,
};

export function useBlockedUsers() {
  return useQuery<BlockedUser[]>({
    queryKey: KEYS.blocked,
    queryFn: () => api.get<BlockedUser[]>('/v1/blocks').then((r) => r.data),
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BlockBody) =>
      api.post<{ success: boolean }>('/v1/blocks', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.blocked });
      void qc.invalidateQueries({ queryKey: ['discovery'] });
      void qc.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete<{ success: boolean }>(`/v1/blocks/${userId}`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.blocked });
    },
  });
}

export function useReportUser() {
  return useMutation({
    mutationFn: (body: ReportBody) =>
      api.post<{ success: boolean }>('/v1/reports', body).then((r) => r.data),
  });
}
