import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConnectionDetail,
  ConnectionItem,
  ConnectionsList,
  CreateConnection,
} from '@manamap/shared';
import { api } from '../api/client';

const KEYS = {
  list: ['connections'] as const,
  detail: (id: string) => ['connections', id] as const,
};

export function useConnections() {
  return useQuery<ConnectionsList>({
    queryKey: KEYS.list,
    queryFn: () => api.get<ConnectionsList>('/v1/connections').then((r) => r.data),
    refetchInterval: 15_000,
  });
}

export function useConnectionDetail(id: string) {
  return useQuery<ConnectionDetail>({
    queryKey: KEYS.detail(id),
    queryFn: () => api.get<ConnectionDetail>(`/v1/connections/${id}`).then((r) => r.data),
  });
}

export function useSendConnectionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateConnection) =>
      api.post<{ id: string; status: string }>('/v1/connections', body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.list }),
  });
}

export function useAcceptConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      api.post<{ id: string; status: string }>(`/v1/connections/${connectionId}/accept`).then((r) => r.data),
    onMutate: async (connectionId) => {
      await qc.cancelQueries({ queryKey: KEYS.list });
      const prev = qc.getQueryData<ConnectionsList>(KEYS.list);
      qc.setQueryData<ConnectionsList>(KEYS.list, (old) => {
        if (!old) return old;
        const item = old.incoming.find((c) => c.id === connectionId);
        if (!item) return old;
        const accepted: ConnectionItem = { ...item, status: 'accepted' };
        return {
          incoming: old.incoming.filter((c) => c.id !== connectionId),
          outgoing: old.outgoing,
          accepted: [accepted, ...old.accepted],
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEYS.list, ctx.prev);
    },
    onSuccess: (_data, connectionId) => {
      void qc.invalidateQueries({ queryKey: KEYS.list });
      void qc.invalidateQueries({ queryKey: KEYS.detail(connectionId) });
      void qc.invalidateQueries({ queryKey: ['quests'] });
    },
  });
}

export function useDeclineConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      api.post(`/v1/connections/${connectionId}/decline`).then((r) => r.data),
    onMutate: async (connectionId) => {
      await qc.cancelQueries({ queryKey: KEYS.list });
      const prev = qc.getQueryData<ConnectionsList>(KEYS.list);
      qc.setQueryData<ConnectionsList>(KEYS.list, (old) => {
        if (!old) return old;
        return { ...old, incoming: old.incoming.filter((c) => c.id !== connectionId) };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEYS.list, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: KEYS.list }),
  });
}
