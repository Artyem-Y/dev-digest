"use client";

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RunSummary } from '@devdigest/shared';
import { API_BASE } from '../api';

export const REVIEW_REFRESH_DEBOUNCE_MS = 250;

/** Refresh read models once for a batch containing previously unseen terminal runs. */
export function useReviewRefresh(prId: string | null | undefined, runs: RunSummary[] | undefined) {
  const queryClient = useQueryClient();
  const refreshed = React.useRef(new Set<string>());
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const intentCompletionHandled = React.useRef(false);
  const initializedPr = React.useRef<string | null>(null);
  const [intentWatch, setIntentWatch] = React.useState(0);

  React.useEffect(() => {
    refreshed.current.clear();
    initializedPr.current = null;
    intentCompletionHandled.current = false;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, [prId]);
  React.useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  React.useEffect(() => {
    if (!prId || !runs) return;
    if (initializedPr.current !== prId) {
      for (const run of runs) {
        if (run.status !== 'running') refreshed.current.add(run.run_id);
      }
      initializedPr.current = prId;
      return;
    }
    const hasUnseenTerminalRun = runs.some((run) => run.status !== 'running' && !refreshed.current.has(run.run_id));
    for (const run of runs) {
      if (run.status !== 'running') refreshed.current.add(run.run_id);
    }
    if (hasUnseenTerminalRun) {
      intentCompletionHandled.current = false;
      setIntentWatch((current) => current + 1);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['reviews', prId] });
        queryClient.invalidateQueries({ queryKey: ['smart-diff', prId] });
        queryClient.invalidateQueries({ queryKey: ['pull-intent', prId] });
        refreshTimer.current = undefined;
      }, REVIEW_REFRESH_DEBOUNCE_MS);
    }
  }, [prId, queryClient, runs]);

  React.useEffect(() => {
    if (!prId || intentWatch === 0 || intentCompletionHandled.current || typeof EventSource === 'undefined') return;
    const source = new EventSource(`${API_BASE}/pulls/${prId}/intent/events`);
    const onEvent = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as { data?: { intentSettled?: boolean } };
        if (!parsed.data?.intentSettled || intentCompletionHandled.current) return;
        intentCompletionHandled.current = true;
        queryClient.invalidateQueries({ queryKey: ['pull-intent', prId] });
        source.close();
      } catch {
        // Ignore malformed and non-JSON SSE messages.
      }
    };
    source.onmessage = onEvent;
    source.addEventListener('result', onEvent as EventListener);
    return () => source.close();
  }, [intentWatch, prId, queryClient]);
}
