import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { RunSummary } from '@devdigest/shared';

const invalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

import { REVIEW_REFRESH_DEBOUNCE_MS, useReviewRefresh } from './use-review-refresh';

function Refresh({ runs }: { runs: RunSummary[] }) {
  useReviewRefresh('pr-1', runs);
  return null;
}

const done = (run_id: string): RunSummary => ({
  run_id,
  agent_id: null,
  agent_name: null,
  provider: null,
  model: null,
  status: 'done',
  error: null,
  duration_ms: 1,
  tokens_in: 0,
  tokens_out: 0,
  findings_count: 0,
  grounding: null,
  ran_at: null,
  score: null,
  blockers: null,
  cost_usd: null,
});

const running = (run_id: string): RunSummary => ({ ...done(run_id), status: 'running' });

describe('useReviewRefresh', () => {
  beforeEach(() => invalidateQueries.mockClear());

  it('coalesces terminal runs that arrive in separate updates into one refresh', async () => {
    vi.useFakeTimers();
    try {
    const { rerender } = render(<Refresh runs={[running('run-1'), running('run-2')]} />);
    rerender(<Refresh runs={[done('run-1')]} />);
    rerender(<Refresh runs={[done('run-1'), done('run-2')]} />);
    await vi.advanceTimersByTimeAsync(REVIEW_REFRESH_DEBOUNCE_MS);

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['reviews', 'pr-1'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['smart-diff', 'pr-1'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: ['pull-intent', 'pr-1'] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes intent when background derivation emits its completion event', () => {
    class MockEventSource {
      static instances: MockEventSource[] = [];
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      private listeners = new Map<string, EventListener>();
      constructor(readonly url: string) { MockEventSource.instances.push(this); }
      addEventListener(type: string, listener: EventListener) { this.listeners.set(type, listener); }
      close() {}
      emit(type: string, data: string) { this.listeners.get(type)?.(new MessageEvent(type, { data })); }
    }
    vi.stubGlobal('EventSource', MockEventSource);
    try {
      const { rerender } = render(<Refresh runs={[running('run-1')]} />);
      rerender(<Refresh runs={[done('run-1')]} />);
      expect(MockEventSource.instances[0]).toBeDefined();
      expect(MockEventSource.instances[0]!.url).toContain('/pulls/pr-1/intent/events');
      MockEventSource.instances[0]!.emit('result', JSON.stringify({ data: { intentSettled: true } }));

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['pull-intent', 'pr-1'] });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not open an intent stream for terminal runs loaded as history', () => {
    class MockEventSource {
      static instances: MockEventSource[] = [];
      constructor() { MockEventSource.instances.push(this); }
      addEventListener() {}
      close() {}
    }
    vi.stubGlobal('EventSource', MockEventSource);
    try {
      render(<Refresh runs={[done('historical-run')]} />);
      expect(MockEventSource.instances).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
