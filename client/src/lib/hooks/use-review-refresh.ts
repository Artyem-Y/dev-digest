"use client";

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RunSummary } from '@devdigest/shared';

/** Refresh read models once per terminal run, including a terminal run first seen after navigation. */
export function useReviewRefresh(prId: string | null | undefined, runs: RunSummary[] | undefined) {
  const queryClient = useQueryClient();
  const refreshed = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!prId || !runs) return;
    for (const run of runs) {
      if (run.status !== 'running' && !refreshed.current.has(run.run_id)) {
        refreshed.current.add(run.run_id);
        queryClient.invalidateQueries({ queryKey: ['reviews', prId] });
        queryClient.invalidateQueries({ queryKey: ['smart-diff', prId] });
      queryClient.invalidateQueries({ queryKey: ['pull-intent', prId] });
      }
    }
  }, [prId, queryClient, runs]);
}
