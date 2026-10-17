"use client";

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RunSummary } from '@devdigest/shared';

/** Refresh read models once for a batch containing previously unseen terminal runs. */
export function useReviewRefresh(prId: string | null | undefined, runs: RunSummary[] | undefined) {
  const queryClient = useQueryClient();
  const refreshed = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!prId || !runs) return;
    const hasUnseenTerminalRun = runs.some((run) => run.status !== 'running' && !refreshed.current.has(run.run_id));
    for (const run of runs) {
      if (run.status !== 'running') refreshed.current.add(run.run_id);
    }
    if (hasUnseenTerminalRun) {
      queryClient.invalidateQueries({ queryKey: ['reviews', prId] });
      queryClient.invalidateQueries({ queryKey: ['smart-diff', prId] });
      queryClient.invalidateQueries({ queryKey: ['pull-intent', prId] });
    }
  }, [prId, queryClient, runs]);
}
