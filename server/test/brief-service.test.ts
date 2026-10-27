import { describe, expect, it, vi } from 'vitest';
import { GenerateBrief } from '../src/modules/brief/application/generate-brief.js';
import { GetBrief } from '../src/modules/brief/application/get-brief.js';
import { BriefInFlight } from '../src/modules/brief/domain/in-flight.js';
import { estimateBriefPromptTokens } from '@devdigest/reviewer-core';

const snapshot = { id: 'p', repoId: 'r', headSha: 'sha', number: 1, title: 'Title', body: null, additions: 1, deletions: 0, files: [{ path: 'src/a.ts', additions: 1, deletions: 0 }] };
const output = { summary: 'summary', risks: { risks: [{ kind: 'bug', title: 'risk', explanation: 'why', severity: 'high', file_refs: ['src/a.ts'] }] }, review_focus: [{ file: 'src/a.ts', line: 1, reason: 'read' }] };

describe('Brief services', () => {
  it('GET reads only the current head SHA and reports stale cache', async () => {
    const read = { getHeadSha: vi.fn().mockResolvedValue('sha'), getSnapshot: vi.fn(), getCache: vi.fn().mockResolvedValue({ brief: { ...output, head_sha: 'old', intent: { intent: '', in_scope: [], out_of_scope: [] }, blast: { changed_symbols: [], downstream: [], summary: '', degraded: true, reason: 'no_data', prior_prs: null }, history: { history: [] } }, sources: [] }), replace: vi.fn() };
    const result = await new GetBrief(read).execute('w', 'p');
    expect(result.cache.cache_state).toBe('stale');
    expect(read.getHeadSha).toHaveBeenCalledWith('w', 'p');
    expect(read.getSnapshot).not.toHaveBeenCalled();
    expect(read.replace).not.toHaveBeenCalled();
  });

  it('makes one structured call, atomically replaces only validated output, and releases a failed guard', async () => {
    const read = { getSnapshot: vi.fn().mockResolvedValue(snapshot), getCache: vi.fn(), replace: vi.fn() };
    const completeStructured = vi.fn().mockResolvedValue({ data: output, model: 'gpt', tokensIn: 1, tokensOut: 1, costUsd: null, raw: '', attempts: 1 });
    const service = new GenerateBrief({ read, projectContext: { resolve: vi.fn().mockResolvedValue({ documents: [], skipped: [] }) }, featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt' }) }, llm: { resolve: vi.fn().mockResolvedValue({ id: 'openai', completeStructured }) } }, new BriefInFlight());
    const result = await service.execute('w', 'p');
    expect(completeStructured).toHaveBeenCalledTimes(1);
    expect(completeStructured.mock.calls[0]![0]).toMatchObject({ maxRetries: 0, schemaName: 'PrBrief' });
    expect(read.replace).toHaveBeenCalledWith('w', 'p', expect.objectContaining({
      brief: expect.objectContaining({ head_sha: 'sha' }),
      telemetry: expect.objectContaining({ provider: 'openai', model: 'gpt', call_count: 1, estimated_tokens: expect.any(Number) }),
    }));
    expect(result.cache.cache_state).toBe('current');
  });

  it('normalizes provider failures and leaves an earlier cache untouched', async () => {
    const read = { getSnapshot: vi.fn().mockResolvedValue(snapshot), getCache: vi.fn(), replace: vi.fn() };
    const service = new GenerateBrief({ read, projectContext: { resolve: vi.fn().mockResolvedValue({ documents: [], skipped: [] }) }, featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt' }) }, llm: { resolve: vi.fn().mockResolvedValue({ id: 'openai', completeStructured: vi.fn().mockRejectedValue(new Error('provider secret detail')) }) } }, new BriefInFlight());
    await expect(service.execute('w', 'p')).rejects.toMatchObject({ statusCode: 502, code: 'external_service_error', message: 'Brief generation failed', details: undefined });
    expect(read.replace).not.toHaveBeenCalled();
  });

  it('continues generation when optional Project Context resolution fails and records it as unavailable', async () => {
    const read = { getSnapshot: vi.fn().mockResolvedValue(snapshot), getCache: vi.fn(), replace: vi.fn() };
    const completeStructured = vi.fn().mockResolvedValue({ data: output, model: 'gpt', tokensIn: 1, tokensOut: 1, costUsd: null, raw: '', attempts: 1 });
    const service = new GenerateBrief({ read, projectContext: { resolve: vi.fn().mockRejectedValue(new Error('checkout unavailable')) }, featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt' }) }, llm: { resolve: vi.fn().mockResolvedValue({ id: 'openai', completeStructured }) } }, new BriefInFlight());

    await expect(service.execute('w', 'p')).resolves.toMatchObject({ cache: { cache_state: 'current' } });
    expect(completeStructured).toHaveBeenCalledOnce();
    expect(read.replace).toHaveBeenCalledWith('w', 'p', expect.objectContaining({
      sources: expect.arrayContaining([expect.objectContaining({ source_kind: 'spec', status: 'unavailable', reason_code: 'project_context_unavailable' })]),
    }));
  });

  it('bounds the actual reviewer-core user message with oversized documents and source metadata', async () => {
    const read = { getSnapshot: vi.fn().mockResolvedValue(snapshot), getCache: vi.fn(), replace: vi.fn() };
    const completeStructured = vi.fn().mockResolvedValue({ data: output, model: 'gpt', tokensIn: 1, tokensOut: 1, costUsd: null, raw: '', attempts: 1 });
    const documents = Array.from({ length: 40 }, (_, index) => ({ path: `docs/${index}.md`, content: 'x'.repeat(20_000), estimatedTokens: 1, provenance: ['direct_agent' as const] }));
    const skipped = Array.from({ length: 100 }, (_, index) => ({ path: `missing/${index}.md`, reason: 'missing' as const, provenance: ['linked_skill' as const] }));
    const service = new GenerateBrief({ read, projectContext: { resolve: vi.fn().mockResolvedValue({ documents, skipped }) }, featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt' }) }, llm: { resolve: vi.fn().mockResolvedValue({ id: 'openai', completeStructured }) } }, new BriefInFlight());
    await service.execute('w', 'p');
    const request = completeStructured.mock.calls[0]![0] as { messages: { role: string; content: string }[] };
    const user = request.messages.find((message) => message.role === 'user')!.content;
    expect(estimateBriefPromptTokens({ system: request.messages.find((message) => message.role === 'system')!.content, user, telemetry: [] })).toBeLessThanOrEqual(8000);
    expect(user).not.toContain('x'.repeat(20_000));
    const persisted = read.replace.mock.calls[0]![2] as { sources: { source_kind: string; status: string }[]; telemetry: { estimated_tokens: number; selected_documents: number } };
    expect(persisted.telemetry.estimated_tokens).toBe(estimateBriefPromptTokens({ system: request.messages.find((message) => message.role === 'system')!.content, user, telemetry: [] }));
    expect(persisted.telemetry.selected_documents).toBe((user.match(/## Project document/g) ?? []).length);
    expect(persisted.sources.filter((source) => source.source_kind === 'spec' && source.status === 'available')).toHaveLength(persisted.telemetry.selected_documents);
  });

  it('bounds long attachment paths as well as document content', async () => {
    const read = { getSnapshot: vi.fn().mockResolvedValue(snapshot), getCache: vi.fn(), replace: vi.fn() };
    const completeStructured = vi.fn().mockResolvedValue({ data: output, model: 'gpt', tokensIn: 1, tokensOut: 1, costUsd: null, raw: '', attempts: 1 });
    const documents = Array.from({ length: 20 }, (_, index) => ({ path: `docs/${index}-${'p'.repeat(10_000)}.md`, content: 'x', estimatedTokens: 1, provenance: ['direct_agent' as const] }));
    const service = new GenerateBrief({ read, projectContext: { resolve: vi.fn().mockResolvedValue({ documents, skipped: [] }) }, featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt' }) }, llm: { resolve: vi.fn().mockResolvedValue({ id: 'openai', completeStructured }) } }, new BriefInFlight());
    await service.execute('w', 'p');
    const request = completeStructured.mock.calls[0]![0] as { messages: { role: string; content: string }[] };
    const user = request.messages.find((message) => message.role === 'user')!.content;
    expect(estimateBriefPromptTokens({ system: request.messages.find((message) => message.role === 'system')!.content, user, telemetry: [] })).toBeLessThanOrEqual(8000);
    expect(user).not.toContain('p'.repeat(10_000));
  });

  it('marks fact components omitted when a long PR body consumes the facts reservation', async () => {
    const read = { getSnapshot: vi.fn().mockResolvedValue({ ...snapshot, body: 'b'.repeat(20_000) }), getCache: vi.fn(), replace: vi.fn() };
    const completeStructured = vi.fn().mockResolvedValue({ data: output, model: 'gpt', tokensIn: 1, tokensOut: 1, costUsd: null, raw: '', attempts: 1 });
    const service = new GenerateBrief({ read, projectContext: { resolve: vi.fn().mockResolvedValue({ documents: [], skipped: [] }) }, featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt' }) }, llm: { resolve: vi.fn().mockResolvedValue({ id: 'openai', completeStructured }) } }, new BriefInFlight());
    await service.execute('w', 'p');
    const request = completeStructured.mock.calls[0]![0] as { messages: { role: string; content: string }[] };
    const user = request.messages.find((message) => message.role === 'user')!.content;
    const persisted = read.replace.mock.calls[0]![2] as { sources: { source_kind: string; status: string; reason_code: string | null }[]; telemetry: { omitted_fact_sources: string[]; truncated_fact_sources: string[] } };
    expect(user).toContain('b'.repeat(100));
    expect(user).not.toContain('b'.repeat(20_000));
    expect(persisted.sources).toContainEqual(expect.objectContaining({ source_kind: 'pr_description', status: 'available', reason_code: 'truncated_to_budget' }));
    expect(persisted.telemetry.truncated_fact_sources).toContain('pr_description');
    expect(user).not.toContain('Changed file: src/a.ts');
    expect(persisted.sources).toContainEqual(expect.objectContaining({ source_kind: 'changed_file', status: 'omitted', reason_code: 'budget_exhausted' }));
    expect(persisted.telemetry.omitted_fact_sources).toContain('changed_file:src/a.ts');
  });

  it('rejects concurrent generation with 409 instead of a second provider call', async () => {
    let unblock!: () => void;
    const wait = new Promise<void>((resolve) => { unblock = resolve; });
    const read = { getSnapshot: vi.fn().mockResolvedValue(snapshot), getCache: vi.fn(), replace: vi.fn() };
    const service = new GenerateBrief({ read, projectContext: { resolve: vi.fn().mockResolvedValue({ documents: [], skipped: [] }) }, featureModels: { resolve: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt' }) }, llm: { resolve: vi.fn().mockResolvedValue({ id: 'openai', completeStructured: vi.fn(async () => { await wait; return { data: output, model: 'gpt', tokensIn: 1, tokensOut: 1, costUsd: null, raw: '', attempts: 1 }; }) }) } }, new BriefInFlight());
    const first = service.execute('w', 'p');
    await expect(service.execute('w', 'p')).rejects.toMatchObject({ statusCode: 409, code: 'brief_generation_in_progress' });
    unblock(); await first;
  });
});
