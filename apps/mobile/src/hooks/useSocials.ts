import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ReorderSocialLinks,
  SocialLink,
  SocialLinkInput,
  UpdateSocialLink,
} from '@manamap/shared';
import { api } from '../api/client';

const KEY = ['me', 'socials'] as const;

export function useSocials() {
  return useQuery<SocialLink[]>({
    queryKey: KEY,
    queryFn: () => api.get<SocialLink[]>('/v1/me/socials').then((r) => r.data),
  });
}

export function useAddSocial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SocialLinkInput) =>
      api.post<SocialLink>('/v1/me/socials', body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSocial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateSocialLink) =>
      api.patch<SocialLink>(`/v1/me/socials/${id}`, body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSocial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/me/socials/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReorderSocials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReorderSocialLinks) =>
      api.patch<SocialLink[]>('/v1/me/socials/reorder', body).then((r) => r.data),
    onSuccess: (updated) => qc.setQueryData(KEY, updated),
  });
}
