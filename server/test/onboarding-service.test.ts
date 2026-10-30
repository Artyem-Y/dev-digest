import { expect, it, vi } from 'vitest';
import { GenerateTour } from '../src/modules/onboarding/application/generate-tour.js';

const usage = { call_count: 0, input_tokens: null, output_tokens: null, cost_usd: null };
const facts = { files: [], edges: [], facts: [], ranked: false, hotnessAvailable: false as const, indexedCount: 0, omittedFiles: 0, omittedFacts: 0, estimatedTokens: 100, sourceAvailable: false, sourceRevision: null, indexStatus: 'unavailable' as const, limitations: ['source unavailable'] };
function setup(previous: unknown = null) {
  if (previous && (previous as { old?: boolean }).old) previous = { repo_id: 'repo', sections: ['architecture', 'critical_paths', 'local_run', 'reading_path', 'first_tasks'].map((id) => ({ id, items: [], unavailable_reason: null })), status: 'partial', source_revision: null, index_revision: null, index_state: 'unavailable', freshness: 'unknown', generated_at: '2026-10-29T12:00:00Z', limitations: [], counts: { indexed_files: null, selected_files: 0, omitted_files: null, estimated_tokens: 0 }, usage };
  const repo = { get: vi.fn(async () => ({ tour: previous ? { json: previous } : null, attempt: null })), admit: vi.fn(async () => ({ id: 'attempt', token: 'token' })), finish: vi.fn(async () => true) };
  const collect = vi.fn(async () => facts);
  const resolve = vi.fn(async () => null);
  const log = vi.fn();
  return { repo, collect, resolve, log, service: new GenerateTour({ repository: repo, collect, resolveProvider: resolve, log }) };
}
it('authorizes before collecting and returns a partial skeleton without provider calls', async () => {
  const x = setup();
  await x.service.execute('workspace', 'repo', { id: 'attempt', token: 'token' });
  expect(x.repo.get.mock.invocationCallOrder[0]).toBeLessThan(x.collect.mock.invocationCallOrder[0]!);
  expect(x.resolve).not.toHaveBeenCalled();
  expect(x.repo.finish).toHaveBeenCalledWith('workspace', 'repo', 'attempt', 'token', 'partial', expect.objectContaining({ status: 'partial', sections: expect.any(Array) }), 'source_unavailable', usage);
});
it('does not access facts for an unauthorized repository', async () => {
  const x = setup(); x.repo.get.mockResolvedValueOnce(null as never);
  await x.service.execute('wrong', 'repo', { id: 'attempt', token: 'token' });
  expect(x.collect).not.toHaveBeenCalled();
});
it('preserves the previous tour when generation fails and reports only safe reason', async () => {
  const x = setup({ old: true });
  await x.service.execute('workspace', 'repo', { id: 'attempt', token: 'token' });
  expect(x.repo.finish).toHaveBeenCalledWith('workspace', 'repo', 'attempt', 'token', 'failed', null, 'source_unavailable', usage);
  expect(JSON.stringify(x.log.mock.calls)).not.toContain('source unavailable');
});

it('makes one provider call and persists only supported generated content', async () => {
  const { service, repo, collect, resolve } = setup();
  collect.mockResolvedValue({ ...facts, sourceAvailable: true, sourceRevision: 'rev', indexStatus: 'full' as never, ranked: true, limitations: [], files: [{ path: 'src/a.ts', rank: 1 }], facts: [{ id: 'p', kind: 'path', value: 'src/a.ts' }] } as never);
  const completeStructured = vi.fn(async () => ({ data: { sections: [
    { id: 'architecture', claims: [], narrative: [] }, { id: 'critical_paths', claims: [], narrative: [] }, { id: 'local_run', claims: [], narrative: [] },
    { id: 'reading_path', claims: [{ fact_id: 'p', template: 'read' }, { fact_id: 'invented', template: 'read' }], narrative: [{ text: 'Read src/a.ts.', fact_ids: ['p'] }, { text: 'Read src/a.ts to deploy payments.', fact_ids: ['p'] }] }, { id: 'first_tasks', claims: [], narrative: [] },
  ] }, model: 'test', reportedUsage: { inputTokens: 0, outputTokens: 2, costUsd: null } }));
  resolve.mockResolvedValue({ provider: { completeStructured }, model: 'test' } as never);
  await service.execute('workspace', 'repo', { id: 'attempt', token: 'token' });
  expect(completeStructured).toHaveBeenCalledTimes(1);
  expect(repo.finish).toHaveBeenCalledWith('workspace', 'repo', 'attempt', 'token', 'generated', expect.objectContaining({ sections: expect.arrayContaining([expect.objectContaining({ id: 'reading_path', items: [{ kind: 'path', text: 'src/a.ts', fact_ids: ['p'] }], narrative: [] })]) }), null, { call_count: 1, input_tokens: 0, output_tokens: 2, cost_usd: null });
});
it('preserves the previous result on provider failure and fences stale completion', async () => {
  const x = setup({ old: true });
  x.collect.mockResolvedValue({ ...facts, sourceAvailable: true, sourceRevision: 'rev', indexStatus: 'full', ranked: true, facts: [{ id: 'p', kind: 'path', value: 'a.ts' }] } as never);
  x.resolve.mockResolvedValue({ provider: { completeStructured: async () => { throw new Error('sensitive details'); } }, model: 'test' } as never);
  x.repo.finish.mockResolvedValue(false);
  await x.service.execute('workspace', 'repo', { id: 'attempt', token: 'old' });
  expect(x.repo.finish).toHaveBeenCalledWith('workspace', 'repo', 'attempt', 'old', 'failed', null, 'provider_failed', expect.objectContaining({ call_count: 1 }));
  expect(x.log).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'stale' }));
  expect(JSON.stringify(x.log.mock.calls)).not.toContain('sensitive details');
});
it('records a safe provider rejection category without exposing the provider response', async () => {
  const x = setup({ old: true });
  x.collect.mockResolvedValue({ ...facts, sourceAvailable: true, sourceRevision: 'rev', indexStatus: 'full', ranked: true, facts: [{ id: 'p', kind: 'path', value: 'a.ts' }] } as never);
  x.resolve.mockResolvedValue({ provider: { completeStructured: async () => { throw Object.assign(new Error('private provider payload'), { status: 400 }); } }, model: 'test' } as never);
  await x.service.execute('workspace', 'repo', { id: 'attempt', token: 'token' });
  expect(x.repo.finish).toHaveBeenCalledWith('workspace', 'repo', 'attempt', 'token', 'failed', null, 'provider_request_rejected', expect.objectContaining({ call_count: 1 }));
  expect(JSON.stringify(x.log.mock.calls)).not.toContain('private provider payload');
});
it('reports a provider billing response without storing its payload', async () => {
  const x = setup({ old: true });
  x.collect.mockResolvedValue({ ...facts, sourceAvailable: true, sourceRevision: 'rev', indexStatus: 'full', ranked: true, facts: [{ id: 'p', kind: 'path', value: 'a.ts' }] } as never);
  x.resolve.mockResolvedValue({ provider: { completeStructured: async () => { throw Object.assign(new Error('private billing payload'), { status: 402 }); } }, model: 'test' } as never);
  await x.service.execute('workspace', 'repo', { id: 'attempt', token: 'token' });
  expect(x.repo.finish).toHaveBeenCalledWith('workspace', 'repo', 'attempt', 'token', 'failed', null, 'provider_billing_required', expect.objectContaining({ call_count: 1 }));
  expect(JSON.stringify(x.log.mock.calls)).not.toContain('private billing payload');
});
it('records cancellation and never reads source when already cancelled', async () => {
  const x = setup({ old: true }); const controller = new AbortController(); controller.abort();
  await x.service.execute('workspace', 'repo', { id: 'attempt', token: 'token' }, controller.signal);
  expect(x.collect).not.toHaveBeenCalled();
  expect(x.repo.finish).toHaveBeenCalledWith('workspace', 'repo', 'attempt', 'token', 'cancelled', null, 'cancelled', usage);
});
it('propagates persistence errors without claiming success', async () => {
  const x = setup(); x.repo.finish.mockRejectedValue(new Error('db details'));
  await expect(x.service.execute('workspace', 'repo', { id: 'attempt', token: 'token' })).rejects.toThrow();
  expect(x.log).toHaveBeenCalledWith({ outcome: 'failed', reason: 'storage_failed', usage });
  expect(JSON.stringify(x.log.mock.calls)).not.toContain('db details');
});

it('computes freshness from current indexed revision without invoking a model', async () => {
  const { GetTour } = await import('../src/modules/onboarding/application/get-tour.js');
  const sectionIds = ['architecture', 'critical_paths', 'local_run', 'reading_path', 'first_tasks'];
  const tour = { repo_id: 'repo', sections: sectionIds.map((id) => ({ id, items: [], unavailable_reason: null })), status: 'partial', source_revision: 'old', index_revision: 'old', index_state: 'ready', freshness: 'unknown', generated_at: '2026-10-29T12:00:00Z', limitations: [], counts: { indexed_files: null, selected_files: 0, omitted_files: null, estimated_tokens: 0 }, usage };
  const x = setup(tour);
  expect((await new GetTour(x.repo, async () => 'new').get('workspace', 'repo'))?.tour?.freshness).toBe('stale');
  expect((await new GetTour(x.repo, async () => null).get('workspace', 'repo'))?.tour?.freshness).toBe('unknown');
  expect(x.resolve).not.toHaveBeenCalled();
});

it('ends a stalled provider at its deadline and retains the previous tour', async () => {
  vi.useFakeTimers();
  try {
    const x = setup({ old: true });
    x.collect.mockResolvedValue({ ...facts, sourceAvailable: true, sourceRevision: 'rev', indexStatus: 'full', ranked: true, facts: [{ id: 'p', kind: 'path', value: 'a.ts' }] } as never);
    x.resolve.mockResolvedValue({ provider: { completeStructured: () => new Promise(() => {}) }, model: 'test' } as never);
    const running = x.service.execute('workspace', 'repo', { id: 'attempt', token: 'token' });
    await vi.advanceTimersByTimeAsync(120001);
    await running;
    expect(x.repo.finish).toHaveBeenCalledWith('workspace', 'repo', 'attempt', 'token', 'failed', null, 'timeout', expect.objectContaining({ call_count: 1 }));
  } finally { vi.useRealTimers(); }
});

it('returns duplicate pending attempt without exposing its fencing token', async () => {
  const x = setup();
  x.repo.admit.mockResolvedValue(null as never);
  x.repo.get.mockResolvedValue({ tour: null, attempt: { id: 'existing', status: 'pending', token: 'secret' } } as never);
  const result = await x.service.start('workspace', 'repo');
  expect(result).toEqual({ id: 'existing', status: 'pending' });
  expect(JSON.stringify(result)).not.toContain('secret');
  expect(x.collect).not.toHaveBeenCalled();
});

it('retains deterministic ranked reading order when model returns reversed or incomplete claims', async () => {
  const x = setup();
  x.collect.mockResolvedValue({ ...facts, sourceAvailable: true, sourceRevision: 'rev', indexStatus: 'full', ranked: true, limitations: [], files: [{ path: 'first.ts', rank: 2 }, { path: 'second.ts', rank: 1 }], facts: [{ id: 'first', kind: 'path', value: 'first.ts' }, { id: 'second', kind: 'path', value: 'second.ts' }] } as never);
  x.resolve.mockResolvedValue({ provider: { completeStructured: async () => ({ data: { sections: [{ id: 'architecture', claims: [], narrative: [] }, { id: 'critical_paths', claims: [], narrative: [] }, { id: 'local_run', claims: [], narrative: [] }, { id: 'reading_path', claims: [{ fact_id: 'second', template: 'read' }], narrative: [] }, { id: 'first_tasks', claims: [], narrative: [] }] }, model: 'test', reportedUsage: { inputTokens: 1, outputTokens: 1, costUsd: null } }) }, model: 'test' } as never);
  await x.service.execute('workspace', 'repo', { id: 'attempt', token: 'token' });
  const result = x.repo.finish.mock.calls[0]![5] as unknown as { sections: Array<{ id: string; items: Array<{ text: string }> }> };
  expect(result.sections.find((section) => section.id === 'reading_path')?.items.map((item) => item.text)).toEqual(['first.ts', 'second.ts']);
});
