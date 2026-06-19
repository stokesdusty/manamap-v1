import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDeckLink,
  DeckLink,
  OnboardingSubmit,
  Privacy,
  Profile,
  SetHomeStore,
  StoreDetail,
  UpdateDeckLink,
  UpdatePrivacy,
  UpdateProfile,
} from '@manamap/shared';
import { api } from '../api/client';

const KEYS = {
  profile: ['me'] as const,
  privacy: ['me', 'privacy'] as const,
  decks: ['me', 'decks'] as const,
  homeStore: ['me', 'home-store'] as const,
  recentStores: ['me', 'recent-stores'] as const,
};

// --- Profile ---

export function useProfile(opts?: { enabled?: boolean }) {
  return useQuery<Profile>({
    queryKey: KEYS.profile,
    queryFn: () => api.get<Profile>('/v1/me').then((r) => r.data),
    enabled: opts?.enabled !== false,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfile) =>
      api.patch<Profile>('/v1/me', body).then((r) => r.data),
    onSuccess: (updated) => {
      qc.setQueryData<Profile>(KEYS.profile, updated);
    },
  });
}

// --- Privacy ---

export function usePrivacy() {
  return useQuery<Privacy>({
    queryKey: KEYS.privacy,
    queryFn: () => api.get<Privacy>('/v1/me/privacy').then((r) => r.data),
  });
}

export function useUpdatePrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePrivacy) =>
      api.patch<Privacy>('/v1/me/privacy', body).then((r) => r.data),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: KEYS.privacy });
      const prev = qc.getQueryData<Privacy>(KEYS.privacy);
      qc.setQueryData<Privacy>(KEYS.privacy, (old) => {
        if (!old) return old;
        return {
          discoverable: patch.discoverable ?? old.discoverable,
          showDiscord: patch.showDiscord ?? old.showDiscord,
          showDecks: patch.showDecks ?? old.showDecks,
          showMetHistory: patch.showMetHistory ?? old.showMetHistory,
          storeMessages: patch.storeMessages ?? old.storeMessages,
          shareNameWithContacts: patch.shareNameWithContacts ?? old.shareNameWithContacts,
          eventReminders: patch.eventReminders ?? old.eventReminders,
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEYS.privacy, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEYS.privacy });
    },
  });
}

// --- Decks ---

export function useDecks() {
  return useQuery<DeckLink[]>({
    queryKey: KEYS.decks,
    queryFn: () => api.get<DeckLink[]>('/v1/me/decks').then((r) => r.data),
  });
}

export function useCreateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDeckLink) =>
      api.post<DeckLink>('/v1/me/decks', body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.decks }),
  });
}

export function useUpdateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateDeckLink) =>
      api.patch<DeckLink>(`/v1/me/decks/${id}`, body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.decks }),
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/me/decks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.decks }),
  });
}

// --- Recent checkin stores ---

export function useRecentCheckinStores() {
  return useQuery<{ stores: Array<{ id: string; name: string; city: string | null; state: string | null }> }>({
    queryKey: KEYS.recentStores,
    queryFn: () =>
      api.get('/v1/me/recent-stores').then((r) => r.data),
  });
}

// --- Home store ---

export function useHomeStore() {
  return useQuery<{ store: StoreDetail | null }>({
    queryKey: KEYS.homeStore,
    queryFn: () =>
      api.get<{ store: StoreDetail | null }>('/v1/me/home-store').then((r) => r.data),
  });
}

export function useSetHomeStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetHomeStore) =>
      api.patch<{ storeId: string | null }>('/v1/me/home-store', body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.homeStore }),
  });
}

// --- Onboarding ---

export function useSubmitOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OnboardingSubmit) =>
      api.post<Profile>('/v1/me/onboarding', body).then((r) => r.data),
    onSuccess: (updated) => {
      qc.setQueryData<Profile>(KEYS.profile, updated);
    },
  });
}
