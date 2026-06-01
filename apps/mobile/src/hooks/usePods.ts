import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePod, PodDetail, PodFeedItem } from '@manamap/shared';
import { api } from '../api/client';

const POD_POLL_INTERVAL = 15_000;

export function usePodFeed(enabled: boolean) {
  return useQuery<PodFeedItem[]>({
    queryKey: ['pods', 'feed'],
    queryFn: async () => {
      const { data } = await api.get<PodFeedItem[]>('/v1/pods');
      return data;
    },
    enabled,
    refetchInterval: POD_POLL_INTERVAL,
    staleTime: 10_000,
  });
}

export function usePodDetail(podId: string) {
  return useQuery<PodDetail>({
    queryKey: ['pods', 'detail', podId],
    queryFn: async () => {
      const { data } = await api.get<PodDetail>(`/v1/pods/${podId}`);
      return data;
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useCreatePod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePod) => api.post('/v1/pods', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pods'] }),
  });
}

export function usePodRequest(podId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/v1/pods/${podId}/request`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pods', 'detail', podId] }),
  });
}

export function usePodApprove(podId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post(`/v1/pods/${podId}/approve`, { userId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pods', 'detail', podId] }),
  });
}

export function usePodDecline(podId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post(`/v1/pods/${podId}/decline`, { userId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pods', 'detail', podId] }),
  });
}

export function useDisband(podId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/v1/pods/${podId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pods'] }),
  });
}

export function usePodLock(podId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/v1/pods/${podId}/lock`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pods'] });
      qc.invalidateQueries({ queryKey: ['encounters'] });
    },
  });
}
