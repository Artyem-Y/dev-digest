import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DeriveIntentService, INTENT_SOURCE_CACHE_TTL_MS } from '../src/modules/intents/application/derive-intent.js';

const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex');
const cachedFingerprint = (title: string) => fingerprint(JSON.stringify([{
  source_kind: 'pr_title', reason_code: null, content_fingerprint: fingerprint(title),
}]));

describe('DeriveIntentService', () => {
  it('derives high-confidence intent from a linked issue through its application port', async () => {
    const findLinkedIssue = vi.fn().mockResolvedValue({ title: 'Prevent duplicate payments', body: 'Reject replayed capture requests.' });
    const completeStructured = vi.fn().mockResolvedValue({
      data: {
        intent: 'Prevent duplicate payment captures.',
        in_scope: ['capture deduplication'],
        out_of_scope: ['refunds'],
        source_refs: [0, 2],
        insufficient_evidence: false,
      },
      model: 'gpt-6-luna', tokensIn: 0, tokensOut: 0, costUsd: null, raw: '', attempts: 1,
    });
    const service = new DeriveIntentService({
      documents: { fetchPlanOrSpec: vi.fn() },
      linkedIssues: { findLinkedIssue },
      featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt-6-luna' }) },
      llm: { resolve: vi.fn().mockResolvedValue({ completeStructured }) },
      intents: { getDerivedIntent: vi.fn().mockResolvedValue(undefined), upsertDerivedIntent: vi.fn() },
    } as never);

    const result = await service.derive({
      workspaceId: 'workspace-1',
      prId: 'pr-1',
      title: 'Deduplicate captures',
      body: 'Fixes #42',
      repo: { owner: 'acme', name: 'payments' },
    } as never);

    expect(findLinkedIssue).toHaveBeenCalledWith({ owner: 'acme', name: 'payments' }, 'Fixes #42');
    expect(result).toMatchObject({ status: 'derived', intent: { confidence: 'high' }, trace: { persistence: 'created' } });
  });

  it('records only classifier-referenced sources as used and persists a contract-valid fingerprint', async () => {
    const completeStructured = vi.fn().mockResolvedValue({
      data: {
        intent: 'Prevent duplicate payment captures.', in_scope: [], out_of_scope: [],
        source_refs: [0, 2], insufficient_evidence: false,
      },
      model: 'gpt-6-luna', tokensIn: 0, tokensOut: 0, costUsd: null, raw: '', attempts: 1,
    });
    const service = new DeriveIntentService({
      documents: { fetchPlanOrSpec: vi.fn().mockResolvedValue({ ok: true, text: 'Implementation plan.' }) },
      linkedIssues: { findLinkedIssue: vi.fn().mockResolvedValue({ title: 'Prevent duplicates', body: 'Use idempotency keys.' }) },
      featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt-6-luna' }) },
      llm: { resolve: vi.fn().mockResolvedValue({ completeStructured }) },
      intents: { getDerivedIntent: vi.fn().mockResolvedValue(undefined), upsertDerivedIntent: vi.fn() },
    } as never);

    const result = await service.derive({
      workspaceId: 'workspace-1', prId: 'pr-1', title: 'Deduplicate captures',
      body: 'Plan https://plans.example/idempotency.md', repo: { owner: 'acme', name: 'payments' },
    } as never);

    expect(result).toMatchObject({
      status: 'derived',
      intent: {
        confidence: 'high',
        evidence: [
          { source_kind: 'pr_title', status: 'used' },
          { source_kind: 'pr_description', status: 'unused' },
          { source_kind: 'github_issue', status: 'used' },
          { source_kind: 'plan_spec', status: 'unused' },
        ],
      },
      trace: { sourceCount: 2 },
    });
    if (result.status === 'derived') expect(result.intent.source_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('reuses an intent only when the selected model and source fingerprint still match, unless manually forced', async () => {
    const findLinkedIssue = vi.fn().mockResolvedValue(undefined);
    const cached = {
      intent: 'Cacheable intent.',
      in_scope: ['payments'],
      out_of_scope: [],
      confidence: 'low' as const,
      evidence: [{ source_kind: 'pr_title' as const, status: 'used' as const, reason_code: null, content_fingerprint: fingerprint('Cacheable PR') }],
      source_fingerprint: cachedFingerprint('Cacheable PR'),
      model_provider: 'openai' as const,
      model: 'gpt-6-luna',
      derived_at: new Date().toISOString(),
    };
    const completeStructured = vi.fn().mockResolvedValue({
      data: { intent: 'Refreshed cacheable intent.', in_scope: [], out_of_scope: [], source_refs: [0], insufficient_evidence: false },
      model: 'gpt-6-luna', tokensIn: 0, tokensOut: 0, costUsd: null, raw: '', attempts: 1,
    });
    const service = new DeriveIntentService({
      documents: { fetchPlanOrSpec: vi.fn() },
      linkedIssues: { findLinkedIssue },
      featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt-6-luna' }) },
      llm: { resolve: vi.fn().mockResolvedValue({ completeStructured }) },
      intents: { getDerivedIntent: vi.fn().mockResolvedValue(cached), upsertDerivedIntent: vi.fn() },
    } as never);

    const result = await service.derive({
      workspaceId: 'workspace-1',
      prId: 'pr-1',
      title: 'Cacheable PR',
      body: null,
      repo: { owner: 'acme', name: 'payments' },
    } as never);

    expect(result).toMatchObject({ status: 'derived', intent: { intent: 'Cacheable intent.' }, trace: { persistence: 'reused' } });
    expect(completeStructured).not.toHaveBeenCalled();
    expect(findLinkedIssue).toHaveBeenCalledOnce();

    const forced = await service.derive({
      workspaceId: 'workspace-1',
      prId: 'pr-1',
      title: 'Cacheable PR',
      body: null,
      repo: { owner: 'acme', name: 'payments' },
      force: true,
    } as never);

    expect(forced).toMatchObject({ status: 'derived', intent: { intent: 'Cacheable PR' } });
    expect(completeStructured).toHaveBeenCalledOnce();
  });

  it('re-derives when linked evidence changes during the intent cache TTL', async () => {
    vi.useFakeTimers();
    try {
    let cached: Record<string, unknown> | undefined;
    const findLinkedIssue = vi.fn()
      .mockResolvedValueOnce({ title: 'Prevent duplicates', body: 'Use idempotency keys.' })
      .mockResolvedValueOnce({ title: 'Prevent duplicates', body: 'Use idempotency keys and audit events.' });
    const completeStructured = vi.fn().mockResolvedValue({
      data: { intent: 'Prevent duplicate payments.', in_scope: [], out_of_scope: [], source_refs: [0, 2], insufficient_evidence: false },
      model: 'gpt-6-luna', tokensIn: 0, tokensOut: 0, costUsd: null, raw: '', attempts: 1,
    });
    const service = new DeriveIntentService({
      documents: { fetchPlanOrSpec: vi.fn() },
      linkedIssues: { findLinkedIssue },
      featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt-6-luna' }) },
      llm: { resolve: vi.fn().mockResolvedValue({ completeStructured }) },
      intents: {
        getDerivedIntent: vi.fn().mockImplementation(() => cached),
        upsertDerivedIntent: vi.fn().mockImplementation((_prId, intent) => { cached = intent; }),
      },
    } as never);
    const input = { workspaceId: 'workspace-1', prId: 'pr-1', title: 'Deduplicate captures', body: 'Fixes #42', repo: { owner: 'acme', name: 'payments' } } as never;

    await expect(service.derive(input)).resolves.toMatchObject({ status: 'derived', trace: { persistence: 'created' } });
    await vi.advanceTimersByTimeAsync(INTENT_SOURCE_CACHE_TTL_MS + 1);
    await expect(service.derive(input)).resolves.toMatchObject({ status: 'derived', trace: { persistence: 'updated' } });
    expect(completeStructured).toHaveBeenCalledTimes(2);
    expect(findLinkedIssue).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reuses fresh linked sources when a persisted intent cache entry matches', async () => {
    let cached: Record<string, unknown> | undefined;
    const findLinkedIssue = vi.fn().mockResolvedValue({ title: 'Issue', body: 'Details' });
    const fetchPlanOrSpec = vi.fn().mockResolvedValue({ ok: true, text: 'Plan details' });
    const completeStructured = vi.fn().mockResolvedValue({
      data: { intent: 'Implement the plan.', in_scope: [], out_of_scope: [], source_refs: [0], insufficient_evidence: false },
      model: 'gpt-6-luna', tokensIn: 0, tokensOut: 0, costUsd: null, raw: '', attempts: 1,
    });
    const service = new DeriveIntentService({
      documents: { fetchPlanOrSpec }, linkedIssues: { findLinkedIssue },
      featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt-6-luna' }) },
      llm: { resolve: vi.fn().mockResolvedValue({ completeStructured }) },
      intents: {
        getDerivedIntent: vi.fn().mockImplementation(() => cached),
        upsertDerivedIntent: vi.fn().mockImplementation((_prId, intent) => { cached = intent; }),
      },
    } as never);
    const input = { workspaceId: 'workspace-1', prId: 'pr-1', title: 'Implement plan', body: 'Fixes #42\nPlan https://plans.example/plan.md', repo: { owner: 'acme', name: 'payments' } } as never;

    await expect(service.derive(input)).resolves.toMatchObject({ status: 'derived', trace: { persistence: 'created' } });
    await expect(service.derive(input)).resolves.toMatchObject({ status: 'derived', trace: { persistence: 'reused' } });
    expect(findLinkedIssue).toHaveBeenCalledOnce();
    expect(fetchPlanOrSpec).toHaveBeenCalledOnce();
    expect(completeStructured).toHaveBeenCalledOnce();
  });

  it('loads linked evidence and plan documents concurrently on a cache miss', async () => {
    const linkedIssue = Promise.withResolvers<{ title: string; body: string | null } | undefined>();
    const findLinkedIssue = vi.fn().mockReturnValue(linkedIssue.promise);
    const fetchPlanOrSpec = vi.fn().mockResolvedValue({ ok: true, text: 'Plan details' });
    const completeStructured = vi.fn().mockResolvedValue({
      data: { intent: 'Add a cache.', in_scope: [], out_of_scope: [], source_refs: [0], insufficient_evidence: false },
      model: 'gpt-6-luna', tokensIn: 0, tokensOut: 0, costUsd: null, raw: '', attempts: 1,
    });
    const service = new DeriveIntentService({
      documents: { fetchPlanOrSpec },
      linkedIssues: { findLinkedIssue },
      featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt-6-luna' }) },
      llm: { resolve: vi.fn().mockResolvedValue({ completeStructured }) },
      intents: { getDerivedIntent: vi.fn().mockResolvedValue(undefined), upsertDerivedIntent: vi.fn() },
    } as never);

    const derivation = service.derive({
      workspaceId: 'workspace-1', prId: 'pr-1', title: 'Add cache',
      body: 'Fixes #42\nPlan https://plans.example/cache.md', repo: { owner: 'acme', name: 'payments' },
    });

    await vi.waitFor(() => {
      expect(findLinkedIssue).toHaveBeenCalledOnce();
      expect(fetchPlanOrSpec).toHaveBeenCalledOnce();
    });
    linkedIssue.resolve(undefined);
    await derivation;
  });

  it('persists a low-confidence title-only intent when the classifier declines the sparse source', async () => {
    const upsertDerivedIntent = vi.fn();
    const service = new DeriveIntentService({
      documents: { fetchPlanOrSpec: vi.fn() },
      linkedIssues: { findLinkedIssue: vi.fn().mockResolvedValue(undefined) },
      featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt-6-luna' }) },
      llm: { resolve: vi.fn().mockResolvedValue({ completeStructured: vi.fn().mockResolvedValue({ data: { intent: '', in_scope: [], out_of_scope: [], source_refs: [0], insufficient_evidence: true } }) }) },
      intents: { getDerivedIntent: vi.fn().mockResolvedValue(undefined), upsertDerivedIntent },
    } as never);

    const result = await service.derive({
      workspaceId: 'workspace-1', prId: 'pr-1', title: 'Add rate limiting', body: null, repo: { owner: 'acme', name: 'payments' },
    } as never);

    expect(result).toMatchObject({ status: 'derived', intent: { intent: 'Add rate limiting', confidence: 'low', in_scope: [], out_of_scope: [] } });
    expect(upsertDerivedIntent).toHaveBeenCalledOnce();
  });
});
