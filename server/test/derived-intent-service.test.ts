import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../src/platform/errors.js';
import { ReviewService, type ReviewServiceDependencies } from '../src/modules/reviews/service.js';

const intent = {
  intent: 'Add rate limiting.',
  in_scope: ['public API'],
  out_of_scope: [],
  confidence: 'low' as const,
  evidence: [],
  source_fingerprint: 'a'.repeat(64),
  model_provider: 'openai' as const,
  model: 'gpt-6-luna',
  derived_at: '2026-10-15T00:00:00.000Z',
};

function service(
  repository: { getPull: ReturnType<typeof vi.fn>; getDerivedIntent: ReturnType<typeof vi.fn>; getRepo?: ReturnType<typeof vi.fn> },
  intentDeriver?: ReviewServiceDependencies['intentDeriver'],
) {
  return new ReviewService({ repository, agents: {}, executor: {}, runBus: {}, intentDeriver } as unknown as ReviewServiceDependencies);
}

describe('ReviewService.derivedIntent', () => {
  it('does not read an intent when the pull is outside the workspace', async () => {
    const repository = { getPull: vi.fn().mockResolvedValue(undefined), getDerivedIntent: vi.fn() };

    await expect(service(repository).derivedIntent('workspace-a', 'pull-a')).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.getDerivedIntent).not.toHaveBeenCalled();
  });

  it('returns the saved source-safe intent for a scoped pull', async () => {
    const repository = { getPull: vi.fn().mockResolvedValue({ id: 'pull-a' }), getDerivedIntent: vi.fn().mockResolvedValue(intent) };

    await expect(service(repository).derivedIntent('workspace-a', 'pull-a')).resolves.toEqual(intent);
  });

  it('re-derives intent for the scoped pull without running a review', async () => {
    const derive = vi.fn().mockResolvedValue({ status: 'derived', intent });
    const repository = {
      getPull: vi.fn().mockResolvedValue({ id: 'pull-a', repoId: 'repo-a', title: 'Add rate limiting', body: null }),
      getDerivedIntent: vi.fn(),
      getRepo: vi.fn().mockResolvedValue({ owner: 'acme', name: 'payments-api' }),
    };

    await expect(service(repository, { derive }).rerunIntent('workspace-a', 'pull-a')).resolves.toEqual(intent);
    expect(derive).toHaveBeenCalledWith({
      workspaceId: 'workspace-a',
      prId: 'pull-a',
      title: 'Add rate limiting',
      body: null,
      repo: { owner: 'acme', name: 'payments-api' },
      force: true,
    });
  });
});
