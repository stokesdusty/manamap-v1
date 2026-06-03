import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CreateGame, Game, GameStats } from '@manamap/shared';

export function usePendingGames() {
  return useQuery<Game[]>({
    queryKey: ['games', 'pending'],
    queryFn: () => api.get('/v1/games/pending').then((r) => r.data),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useMyGames(limit = 10) {
  return useQuery<Game[]>({
    queryKey: ['games', 'me', limit],
    queryFn: () => api.get('/v1/games/me', { params: { limit } }).then((r) => r.data),
    staleTime: 60 * 1000,
  });
}

export function useMyGameStats() {
  return useQuery<GameStats>({
    queryKey: ['me', 'stats'],
    queryFn: () => api.get('/v1/me/stats').then((r) => r.data),
    staleTime: 60 * 1000,
  });
}

export function useCreateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateGame) => api.post<Game>('/v1/games', dto).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games', 'pending'] });
    },
  });
}

export function useConfirmGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameId: string) =>
      api.post<{ success: boolean; allConfirmed: boolean }>(`/v1/games/${gameId}/confirm`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games', 'pending'] });
      void qc.invalidateQueries({ queryKey: ['me', 'stats'] });
      void qc.invalidateQueries({ queryKey: ['games', 'me'] });
      void qc.invalidateQueries({ queryKey: ['leaderboard'] });
      void qc.invalidateQueries({ queryKey: ['quests'] });
      void qc.invalidateQueries({ queryKey: ['rivalries'] });
    },
  });
}

export function useDisputeGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameId: string) =>
      api.post<{ success: boolean }>(`/v1/games/${gameId}/dispute`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games', 'pending'] });
    },
  });
}
