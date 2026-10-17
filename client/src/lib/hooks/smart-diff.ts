"use client";

import { useQuery } from '@tanstack/react-query';
import type { SmartDiff } from '@devdigest/shared';
import { api } from '../api';

export function useSmartDiff(prId: string | null | undefined, detailReady = false) {
  return useQuery({
    queryKey: ['smart-diff', prId],
    queryFn: () => api.get<SmartDiff>(`/pulls/${prId}/smart-diff`),
    // The detail request refreshes the server's PR-file snapshot. Do not read
    // a grouped snapshot until that source of truth has completed.
    enabled: !!prId && detailReady,
  });
}
