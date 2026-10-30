'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OnboardingTourResponse } from '@devdigest/shared';
import { api } from '../api';
const key = (repoId: string) => ['onboarding-tour', repoId] as const;
export function useOnboardingTour(repoId: string) {
  return useQuery({ queryKey: key(repoId), queryFn: () => api.get<OnboardingTourResponse>(`/repos/${encodeURIComponent(repoId)}/onboarding-tour`), enabled: Boolean(repoId),
    refetchInterval: (query) => query.state.data?.attempt?.status === 'pending' ? 1000 : false });
}
export function useGenerateOnboardingTour(repoId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post<{ id: string; status: 'pending' }>(`/repos/${encodeURIComponent(repoId)}/onboarding-tour`), onSuccess: () => qc.invalidateQueries({ queryKey: key(repoId) }) });
}
export function readTourFile(repoId: string, path: string, revision: string) {
  const query = new URLSearchParams({ path, revision });
  return api.get<{ path: string; revision: string; content: string }>(`/repos/${encodeURIComponent(repoId)}/onboarding-tour/file?${query}`);
}
