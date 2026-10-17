import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { RunSummary } from '@devdigest/shared';

const invalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

import { useReviewRefresh } from './use-review-refresh';

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

describe('useReviewRefresh', () => {
  it('invalidates each read model once for multiple newly terminal runs', () => {
    render(<Refresh runs={[done('run-1'), done('run-2')]} />);

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['reviews', 'pr-1'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['smart-diff', 'pr-1'] });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: ['pull-intent', 'pr-1'] });
  });
});
