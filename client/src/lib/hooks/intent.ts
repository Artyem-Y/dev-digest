"use client";

import { useQuery } from '@tanstack/react-query';
import type { DerivedIntent } from '@/vendor/shared/contracts/brief';
import { api } from '../api';

export function useDerivedIntent(prId: string | null | undefined) {
  return useQuery({
    queryKey: ['pull-intent', prId],
    queryFn: () => api.get<DerivedIntent | null>(`/pulls/${prId}/intent`),
    enabled: !!prId,
  });
}
