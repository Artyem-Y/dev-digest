import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import { analyzeRepository, renderMarkdown } from './analyze-dependencies.mjs';
import { gradeReport } from '../evals/grade-report.mjs';
import { aggregate } from '../evals/run-evals.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(here, '../evals/fixtures/repo');

test('classifies direct dependency kinds and leaves absent installed sizes unavailable', async () => {
  const report = await analyzeRepository(fixtureRoot);
  const runtime = report.dependencies.find(
    (item) => item.workspace === 'server' && item.package === 'fastify',
  );
  const optional = report.dependencies.find(
    (item) => item.workspace === 'server' && item.package === '@fastify/compress',
  );
  const peer = report.dependencies.find(
    (item) => item.workspace === 'client' && item.package === 'react',
  );

  assert.equal(runtime.kind, 'production');
  assert.equal(optional.kind, 'optional');
  assert.equal(peer.kind, 'peer');
  assert.equal(runtime.size_bytes, null);
  assert.equal(runtime.size_status, 'unavailable');
  assert.equal(runtime.downstream_count, 0);
  assert.equal(
    report.dependencies.find((item) => item.workspace === 'client' && item.package === 'vitest').downstream_count,
    1,
  );
  assert.ok(report.generated_at);
  assert.ok(report.source_files.includes('server/package.json'));
});

test('reports an internal import cycle and makes it P0', async () => {
  const report = await analyzeRepository(fixtureRoot);
  assert.deepEqual(report.cycles, [
    {
      members: [
        'server/src/modules/billing/service.ts',
        'server/src/modules/billing/summary.ts',
      ],
      type: 'internal-import-cycle',
    },
  ]);
  assert.equal(report.recommendations[0].priority, 'P0');
  assert.match(report.recommendations[0].evidence.join(' '), /summary\.ts/);
});

test('resolves configured aliases and finds duplicate resolved versions', async () => {
  const report = await analyzeRepository(fixtureRoot);
  assert.ok(
    report.internal_edges.some(
      (edge) =>
        edge.from === 'server/src/modules/billing/routes.ts' &&
        edge.to === 'server/src/modules/billing/service.ts' &&
        edge.via === '@billing/service',
    ),
  );
  assert.deepEqual(report.duplicates, [
    { package: 'cookie', versions: ['0.6.0', '0.7.1'] },
  ]);
});

test('renders Mermaid and a JSON-grounded recommendation table', async () => {
  const markdown = renderMarkdown(await analyzeRepository(fixtureRoot));
  assert.match(markdown, /```mermaid/);
  assert.match(markdown, /\| Priority \| Evidence \| Impact \| Next action \|/);
  assert.match(markdown, /Other workspace users/);
  assert.match(markdown, /Installed-size measurements unavailable/);
});

test('report stays JSON serializable', async () => {
  const report = await analyzeRepository(fixtureRoot);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
  const expected = JSON.parse(
    await readFile(path.join(here, '../evals/expected.json'), 'utf8'),
  );
  assert.deepEqual(expected.required_workspaces, ['client', 'e2e', 'mcp', 'reviewer-core', 'server']);
});

test('grader accepts the expected fixture report and rejects a missing P0 cycle', async () => {
  const report = await analyzeRepository(fixtureRoot);
  const expected = JSON.parse(
    await readFile(path.join(here, '../evals/expected.json'), 'utf8'),
  );
  assert.equal(gradeReport(report, expected).pass, true);
  assert.equal(gradeReport({ ...report, cycles: [] }, expected).pass, false);
});

test('aggregate produces statistics for five baseline and five candidate runs', () => {
  const fiveRuns = Array.from({ length: 5 }, (_, index) => ({
    valid: true,
    grade: { pass: index % 2 === 0 },
    elapsed_ms: 100 + index,
    tokens: 10 + index,
  }));
  const benchmark = aggregate({ baseline: fiveRuns, candidate: fiveRuns });
  assert.equal(benchmark.baseline.attempted_runs, 5);
  assert.equal(benchmark.baseline.valid_runs, 5);
  assert.equal(benchmark.candidate.attempted_runs, 5);
  assert.equal(benchmark.candidate.valid_runs, 5);
  assert.ok(Number.isFinite(benchmark.delta.pass_rate));
  assert.ok(Number.isFinite(benchmark.candidate.tokens.stddev));
});
