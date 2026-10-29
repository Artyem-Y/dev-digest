import { assembleOnboardingPrompt, estimateOnboardingPromptTokens } from '@devdigest/reviewer-core';
import { describe, expect, it } from 'vitest';
import { selectOnboardingFacts } from '../src/modules/onboarding/domain/facts.js';

describe('onboarding fact selection', () => {
  it('preserves architecture documentation alongside graph facts within the budget', () => {
    const facts = [{ id: 'documentation:1', kind: 'documentation' as const, value: 'The API handles repository indexing.' }, ...Array.from({ length: 200 }, (_, i) => ({ id: `dependency:${i}`, kind: 'dependency' as const, value: 'x'.repeat(100) }))];
    const result = selectOnboardingFacts({ files: [], edges: [], facts, indexedCount: 0, estimate: (items) => JSON.stringify(items).length });
    expect(result.facts).toContainEqual(facts[0]);
  });
  it('keeps ranked reading paths and commands when dependencies exceed the prompt budget', () => {
    const files = [{ path: 'important.ts', rank: 2 }, { path: 'other.ts', rank: 1 }];
    const facts = [ ...Array.from({ length: 200 }, (_, i) => ({ id: `dependency:${i}`, kind: 'dependency' as const, value: 'x'.repeat(100) })),
      { id: 'path:important', kind: 'path' as const, value: 'important.ts' }, { id: 'path:other', kind: 'path' as const, value: 'other.ts' },
      { id: 'script:dev', kind: 'command' as const, value: 'npm run dev' } ];
    const result = selectOnboardingFacts({ files, facts, edges: [{ fromFile: 'important.ts', toFile: 'other.ts' }], indexedCount: 2, estimate: (items) => JSON.stringify(items).length });
    expect(result.facts).toEqual(expect.arrayContaining([expect.objectContaining({ value: 'important.ts' }), expect.objectContaining({ value: 'npm run dev' })]));
    expect(result.estimatedTokens).toBeLessThanOrEqual(12000);
  });
  it('is deterministic and reports bounded files with a lexical unranked fallback', () => {
    const files = Array.from({ length: 5001 }, (_, i) => ({ path: `file-${String(i).padStart(5, '0')}`, rank: 1 }));
    const a = selectOnboardingFacts({ estimate: (items) => estimateOnboardingPromptTokens(assembleOnboardingPrompt(items)), files, edges: [], facts: [], indexedCount: 5001 });
    const b = selectOnboardingFacts({ estimate: (items) => estimateOnboardingPromptTokens(assembleOnboardingPrompt(items)), files: [...files].reverse(), edges: [], facts: [], indexedCount: 5001 });
    expect(a).toEqual(b);
    expect(a.files).toHaveLength(5000);
    expect(a.omittedFiles).toBe(1);
    expect(a.ranked).toBe(false);
    expect(a.files[0]).toEqual({ path: 'file-00000', rank: null });
  });
  it('breaks equal ranks by path and bounds oversized facts', () => {
    const result = selectOnboardingFacts({ estimate: (items) => estimateOnboardingPromptTokens(assembleOnboardingPrompt(items)), files: [{path: 'z', rank: 1}, {path: 'a', rank: 1}], edges: [{fromFile: 'a', toFile: 'z'}], indexedCount: 2, facts: [{ id: 'big', kind: 'observation', value: 'x'.repeat(100000) }] });
    expect(result.files.map((file) => file.path)).toEqual(['a', 'z']);
    expect(result.facts).toHaveLength(0);
    expect(result.omittedFacts).toBe(1);
    expect(result.estimatedTokens).toBeLessThanOrEqual(12000);
  });
});

it('builds a partial skeleton from supported scripts and preserves the captured revision', async () => {
  const { collectOnboardingFacts } = await import('../src/modules/onboarding/application/collect-facts.js');
  const { buildOnboardingSkeleton } = await import('../src/modules/onboarding/domain/skeleton.js');
  const result = await collectOnboardingFacts({ getOnboardingSnapshot: async () => ({ state: { lastIndexedSha: 'abc', status: 'partial', filesIndexed: 1, filesSkipped: 0 }, files: [{ path: 'src/a.ts', rank: 1 }], edges: [], fileFacts: [], edgesMayBeTruncated: false, indexedCount: 1, graphAvailable: false, hotnessAvailable: false }) }, { revision: 'abc', available: async () => true, read: async (path) => path === 'package.json' ? JSON.stringify({ scripts: { test: 'vitest' } }) : '// TODO improve' }, 'repo');
  expect(result.sourceRevision).toBe('abc');
  expect(result.ranked).toBe(false);
  expect(result.facts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'observation', value: 'TODO at src/a.ts:1' })]));
  const sections = buildOnboardingSkeleton(result.facts);
  expect(sections.map((s) => s.id)).toEqual(['architecture', 'critical_paths', 'local_run', 'reading_path', 'first_tasks']);
  expect(sections[2].items).toEqual([{ kind: 'command', text: 'npm run test', fact_ids: ['script:test'] }]);
});

it('captures the text and source location of a TODO comment instead of a bare location', async () => {
  const { collectOnboardingFacts } = await import('../src/modules/onboarding/application/collect-facts.js');
  const snapshot = { state: { lastIndexedSha: 'rev', status: 'full', filesIndexed: 1, filesSkipped: 0 }, files: [{ path: 'src/a.ts', rank: 1 }], edges: [], fileFacts: [], edgesMayBeTruncated: false, indexedCount: 1, graphAvailable: false, hotnessAvailable: false };
  const result = await collectOnboardingFacts({ getOnboardingSnapshot: async () => snapshot }, { revision: 'rev', available: async () => true, read: async (path) => path === 'src/a.ts' ? '// TODO: add coverage for invalid paths' : null }, 'repo');
  expect(result.facts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'observation', value: 'TODO at src/a.ts:1: add coverage for invalid paths' })]));
});

it('finds scripts in indexed package directories and includes their working directory', async () => {
  const { collectOnboardingFacts } = await import('../src/modules/onboarding/application/collect-facts.js');
  const result = await collectOnboardingFacts({ getOnboardingSnapshot: async () => ({ state: { lastIndexedSha: 'rev', status: 'full', filesIndexed: 1, filesSkipped: 0 }, files: [{ path: 'client/src/index.ts', rank: 1 }], edges: [], fileFacts: [], edgesMayBeTruncated: false, indexedCount: 1, graphAvailable: false, hotnessAvailable: false }) }, { revision: 'rev', available: async () => true, read: async (path) => path === 'client/package.json' ? JSON.stringify({ scripts: { dev: 'next dev' } }) : null }, 'repo');
  expect(result.facts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'command', value: 'cd client && npm run dev' })]));
});

it('extracts bounded plain architecture sentences from pinned documentation', async () => {
  const { collectOnboardingFacts } = await import('../src/modules/onboarding/application/collect-facts.js');
  const result = await collectOnboardingFacts({ getOnboardingSnapshot: async () => ({ state: { lastIndexedSha: 'rev', status: 'full', filesIndexed: 1, filesSkipped: 0 }, files: [{ path: 'server/src/app.ts', rank: 1 }], edges: [], fileFacts: [], edgesMayBeTruncated: false, indexedCount: 1, graphAvailable: false, hotnessAvailable: false }) }, { revision: 'rev', available: async () => true, read: async (path) => path === 'server/README.md' ? '# API\nThe API handles repository indexing.\n' : null }, 'repo');
  expect(result.facts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'documentation', value: 'The API handles repository indexing.' })]));
});

it('extracts documented component connections from a Mermaid architecture diagram', async () => {
  const { collectOnboardingFacts } = await import('../src/modules/onboarding/application/collect-facts.js');
  const readme = '# Architecture\n```mermaid\nflowchart LR\nWEB["client/<br/>Next.js"]\nAPI["server/<br/>Fastify"]\nPG[("Postgres")]\nWEB -->|"REST"| API\nAPI --> PG\n```';
  const result = await collectOnboardingFacts({ getOnboardingSnapshot: async () => ({ state: { lastIndexedSha: 'rev', status: 'full', filesIndexed: 1, filesSkipped: 0 }, files: [{ path: 'server/src/app.ts', rank: 1 }], edges: [], fileFacts: [], edgesMayBeTruncated: false, indexedCount: 1, graphAvailable: false, hotnessAvailable: false }) }, { revision: 'rev', available: async () => true, read: async (path) => path === 'README.md' ? readme : null }, 'repo');
  expect(result.facts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'architecture_edge', value: 'client/ -> server/' }), expect.objectContaining({ kind: 'architecture_edge', value: 'server/ -> Postgres' })]));
});

it('rejects unsafe paths and symlinks and reads blobs only at the pinned revision', async () => {
  const { vi } = await import('vitest');
  const { RevisionSourceReader } = await import('../src/modules/onboarding/infrastructure/source-reader.js');
  const revision = 'a'.repeat(40);
  const object = 'b'.repeat(40);
  const run = vi.fn(async (_cmd: string, args: string[]) => ({ stdout: args.includes('ls-tree') ? `100644 blob ${object}\tpackage.json\0` : 'manifest', stderr: '' }));
  const reader = new RevisionSourceReader('/checkout', revision, run as never);
  expect(await reader.read('../.env')).toBeNull();
  expect(await reader.read('.env.local')).toBeNull();
  expect(run).not.toHaveBeenCalled();
  expect(await reader.read('package.json')).toBe('manifest');
  expect(run.mock.calls[0]?.[1]).toContain(revision);
  expect(run.mock.calls[1]?.[1]).toContain(object);
  run.mockImplementationOnce(async () => ({ stdout: `120000 blob ${object}\tlink\0`, stderr: '' }));
  expect(await reader.read('link')).toBeNull();
});

it('does not read a checkout when source and snapshot revisions differ', async () => {
  const { vi } = await import('vitest');
  const { collectOnboardingFacts } = await import('../src/modules/onboarding/application/collect-facts.js');
  const read = vi.fn();
  const result = await collectOnboardingFacts({ getOnboardingSnapshot: async () => ({ state: { lastIndexedSha: 'new', status: 'full', filesIndexed: 0, filesSkipped: 0 }, files: [], edges: [], fileFacts: [], edgesMayBeTruncated: false, indexedCount: 0, graphAvailable: false, hotnessAvailable: false }) }, { revision: 'old', available: async () => true, read }, 'repo');
  expect(read).not.toHaveBeenCalled();
  expect(result.sourceAvailable).toBe(false);
});

it('treats an available pinned non-Node checkout as source even without package.json', async () => {
  const { collectOnboardingFacts } = await import('../src/modules/onboarding/application/collect-facts.js');
  const result = await collectOnboardingFacts({ getOnboardingSnapshot: async () => ({ state: { lastIndexedSha: 'rev', status: 'full', filesIndexed: 1, filesSkipped: 0 }, files: [{ path: 'main.go', rank: 1 }], edges: [], fileFacts: [], edgesMayBeTruncated: false, indexedCount: 1, graphAvailable: false, hotnessAvailable: false }) }, { revision: 'rev', available: async () => true, read: async (path: string) => path === 'go.mod' ? 'module example.test/app\n\ngo 1.22\n' : null }, 'repo');
  expect(result.sourceAvailable).toBe(true);
  expect(result.facts).toContainEqual({ id: 'stack:go', kind: 'stack', value: 'Go (go.mod)' });
  expect(result.facts.some((fact) => fact.kind === 'command')).toBe(false);
  expect(result.limitations).not.toContain('Source manifest unavailable');
});

it('extracts only explicit Makefile targets and never copies recipe text', async () => {
  const { collectOnboardingFacts } = await import('../src/modules/onboarding/application/collect-facts.js');
  const source = { revision: 'rev', available: async () => true, read: async (path: string) => path === 'Makefile' ? 'test:\n\tgo test ./...\nrun-server: ## Start server\n\tgo run ./cmd\ndeploy:\n\tkubectl apply -f prod\nclean:\n\trm -rf data\n%.o: %.c\n\tcompile\n.PHONY: test\n' : path === 'go.mod' ? 'module example.test/app\n' : null };
  const result = await collectOnboardingFacts({ getOnboardingSnapshot: async () => ({ state: { lastIndexedSha: 'rev', status: 'full', filesIndexed: 0, filesSkipped: 0 }, files: [], edges: [], fileFacts: [], edgesMayBeTruncated: false, indexedCount: 0, graphAvailable: false, hotnessAvailable: false }) }, source, 'repo');
  expect(result.facts.filter((fact) => fact.kind === 'command').map((fact) => fact.value).sort()).toEqual(['make run-server', 'make test']);
  expect(JSON.stringify(result.facts)).not.toContain('go test ./...');
});

it('builds ranked critical dependency chains with deterministic tie-breaks', async () => {
  const { buildCriticalPathFacts } = await import('../src/modules/onboarding/domain/facts.js');
  const paths = buildCriticalPathFacts([{ path: 'a', rank: 5 }, { path: 'c', rank: 2 }, { path: 'b', rank: 2 }, { path: 'd', rank: 1 }], [{ fromFile: 'a', toFile: 'c' }, { fromFile: 'a', toFile: 'b' }, { fromFile: 'b', toFile: 'd' }]);
  expect(paths[0]).toEqual(['a', 'b', 'd']);
});

it('does not repeat a chain that is entirely contained in a longer chain', async () => {
  const { buildCriticalPathFacts } = await import('../src/modules/onboarding/domain/facts.js');
  const paths = buildCriticalPathFacts([{ path: 'a', rank: 3 }, { path: 'b', rank: 2 }, { path: 'c', rank: 1 }], [{ fromFile: 'a', toFile: 'b' }, { fromFile: 'b', toFile: 'c' }]);
  expect(paths).toEqual([['a', 'b', 'c']]);
});

it('provides an explicitly exploratory first task from the highest ranked available path', async () => {
  const { buildOnboardingSkeleton } = await import('../src/modules/onboarding/domain/skeleton.js');
  const sections = buildOnboardingSkeleton([{ id: 'second', kind: 'path', value: 'second.ts' }, { id: 'first', kind: 'path', value: 'first.ts' }], [{ path: 'first.ts', rank: 3 }, { path: 'second.ts', rank: 1 }]);
  expect(sections[4].items).toEqual([{ kind: 'suggestion', text: 'Suggestion: explore first.ts', fact_ids: ['first'] }]);
});

it('creates an actionable exploratory task from a real dependency chain', async () => {
  const { buildOnboardingSkeleton } = await import('../src/modules/onboarding/domain/skeleton.js');
  const sections = buildOnboardingSkeleton([{ id: 'critical:1', kind: 'critical_path', value: 'src/app.ts -> src/db.ts' }, { id: 'path:1', kind: 'path', value: 'src/app.ts' }], [{ path: 'src/app.ts', rank: 2 }]);
  expect(sections[4].items).toContainEqual({ kind: 'suggestion', text: 'Suggestion: trace how src/app.ts uses src/db.ts and identify the relevant tests.', fact_ids: ['critical:1'] });
});
