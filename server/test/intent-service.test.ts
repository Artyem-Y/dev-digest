import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DeriveIntentService } from '../src/modules/intents/application/derive-intent.js';

const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex');

describe('DeriveIntentService', () => {
  it('derives high-confidence intent from a linked issue through its application port', async () => {
    const findLinkedIssue = vi.fn().mockResolvedValue({ title: 'Prevent duplicate payments', body: 'Reject replayed capture requests.' });
    const completeStructured = vi.fn().mockResolvedValue({
      data: {
        intent: 'Prevent duplicate payment captures.',
        in_scope: ['capture deduplication'],
        out_of_scope: ['refunds'],
        source_refs: [0, 1],
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
    expect(result).toMatchObject({ status: 'derived', intent: { confidence: 'high' } });
  });

  it('reuses an intent only when the selected model and source fingerprint still match', async () => {
    const cached = {
      intent: 'Cacheable intent.',
      in_scope: ['payments'],
      out_of_scope: [],
      confidence: 'low' as const,
      evidence: [{ source_kind: 'pr_title' as const, status: 'used' as const, reason_code: null, content_fingerprint: fingerprint('Cacheable PR') }],
      source_fingerprint: fingerprint('Cacheable PR'),
      model_provider: 'openai' as const,
      model: 'gpt-6-luna',
      derived_at: '2026-10-10T00:00:00.000Z',
    };
    const completeStructured = vi.fn();
    const service = new DeriveIntentService({
      documents: { fetchPlanOrSpec: vi.fn() },
      linkedIssues: { findLinkedIssue: vi.fn().mockResolvedValue(undefined) },
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

    expect(result).toMatchObject({ status: 'derived', intent: { intent: 'Cacheable intent.' } });
    expect(completeStructured).not.toHaveBeenCalled();
  });
});
