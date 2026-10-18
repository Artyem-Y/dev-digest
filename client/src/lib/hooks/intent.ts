"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DerivedIntent } from '@/vendor/shared/contracts/brief';
import { api } from '../api';

export function useDerivedIntent(prId: string | null | undefined) {
  return useQuery({
    queryKey: ['pull-intent', prId],
    queryFn: () => api.get<DerivedIntent | null>(`/pulls/${prId}/intent`),
    enabled: !!prId,
  });
}

/** Re-runs just the intent derivation; this never starts a full PR review. */
export function useRerunIntent(prId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<DerivedIntent | null>(`/pulls/${prId}/intent`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pull-intent', prId] }),
  });
}
