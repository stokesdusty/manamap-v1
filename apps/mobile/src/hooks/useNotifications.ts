import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsPage {
  items: NotificationItem[];
  nextCursor: string | null;
}

export function useNotifications(enabled = true) {
  return useInfiniteQuery<NotificationsPage>({
    queryKey: ['notifications'],
    enabled,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) params.set('cursor', pageParam as string);
      const res = await api.get<NotificationsPage>(`/v1/notifications?${params}`);
      return res.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });
}

export function useNotificationUnreadCount(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    enabled,
    queryFn: async () => {
      const res = await api.get<{ count: number }>('/v1/notifications/unread-count');
      return res.data.count;
    },
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      await api.post('/v1/notifications/read', { ids });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
