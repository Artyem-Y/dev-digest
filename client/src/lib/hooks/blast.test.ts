import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useQuery: vi.fn(), get: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.useQuery }));
vi.mock('../api', () => ({ api: { get: mocks.get } }));

import { useBlastRadius } from './blast';

describe('useBlastRadius', () => {
  it('fetches the workspace-scoped blast route only after the Overview panel is active', async () => {
    useBlastRadius('pull-1', true);
    const options = mocks.useQuery.mock.calls[0]![0];

    expect(options.queryKey).toEqual(['blast-radius', 'pull-1']);
    expect(options.enabled).toBe(true);
    await options.queryFn();
    expect(mocks.get).toHaveBeenCalledWith('/pulls/pull-1/blast');

    useBlastRadius('pull-1', false);
    expect(mocks.useQuery.mock.calls[1]![0].enabled).toBe(false);
    expect(mocks.useQuery.mock.calls[1]![0].staleTime).toBe(5 * 60 * 1_000);
  });
});
