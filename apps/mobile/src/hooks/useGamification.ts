import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { LeaderboardResponse, UserBadge } from '@manamap/shared';

export interface StreaksSummary {
  bestCurrentStreak: number;
  bestLongestStreak: number;
  totalCheckins: number;
}

export function useBadges() {
  return useQuery<UserBadge[]>({
    queryKey: ['me', 'badges'],
    queryFn: () => api.get('/v1/me/badges').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStreaksSummary() {
  return useQuery<StreaksSummary>({
    queryKey: ['me', 'streaks'],
    queryFn: () => api.get('/v1/me/streaks').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeaderboard(storeId: string | null) {
  return useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', storeId],
    queryFn: () => api.get(`/v1/stores/${storeId}/leaderboard`).then((r) => r.data),
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });
}
