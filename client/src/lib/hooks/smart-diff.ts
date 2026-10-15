"use client";

import { useQuery } from '@tanstack/react-query';
import type { SmartDiff } from '@devdigest/shared';
import { api } from '../api';

export function useSmartDiff(prId: string | null | undefined) {
  return useQuery({
    queryKey: ['smart-diff', prId],
    queryFn: () => api.get<SmartDiff>(`/pulls/${prId}/smart-diff`),
    enabled: !!prId,
  });
}
