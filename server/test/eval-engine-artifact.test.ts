import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadEvalEngine } from '../src/modules/evals/infrastructure/engine-artifact.js';
import { findFixture, fixtureHash } from '../src/modules/evals/infrastructure/prepared-fixtures.js';

describe('executable eval artifact', () => {
  it('executes the hashed bundle and fails closed when bytes or manifest change', async () => {
    execFileSync(process.execPath, ['scripts/build-eval-engine.mjs']);
    const directory = await mkdtemp(join(tmpdir(), 'eval-artifact-'));
    try {
      const artifact = join(directory, 'engine.mjs');
      const manifest = join(directory, 'manifest.json');
      const bytes = await readFile(resolve('dist/eval-engine.mjs'));
      await writeFile(artifact, bytes);
      await writeFile(manifest, await readFile(resolve('dist/eval-engine.manifest.json')));
      const loaded = await loadEvalEngine(artifact, manifest);
      expect(loaded?.version).toMatch(/^sha256:[a-f0-9]{64}$/);
      const result = await loaded!.engine.runSuite({ review: async () => ({ grounded: [{ file: 'a.ts', startLine: 2, endLine: 2 }], dropped: 0, costUsd: null }) },
        { systemPrompt: 'test', provider: 'openai', model: 'test', strategy: 'single-pass', skills: [] },
        [{ id: 'case', expectation: 'must_find', anchor: { file: 'a.ts', startLine: 2, endLine: 2 }, fixtureId: 'test', fixtureHash: 'test' }]);
      expect(result.score?.recall).toBe(1);
      expect(new loaded!.engine.OpenAIProvider('test')).toBeDefined();
      expect(new loaded!.engine.AnthropicProvider('test')).toBeDefined();
      expect(new loaded!.engine.OpenRouterProvider('test')).toBeDefined();
      expect(loaded!.engine.secretKeyName('openai')).toBe('OPENAI_API_KEY');
      const provider = loaded!.engine.createProvider('openai', 'test');
      (provider as unknown as { client: unknown }).client = { chat: { completions: { create: async () => ({
        choices: [{ message: { content: JSON.stringify({ verdict: 'approve', summary: 'ok', score: 100, findings: [] }) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }) } } };
      const fixture = findFixture('synthetic-unchecked-division-v1')!;
      const reviewer = loaded!.engine.createEvalReviewer(async () => provider);
      const reviewed = await loaded!.engine.runSuite(reviewer,
        { systemPrompt: 'review', provider: 'openai', model: 'gpt-4', strategy: 'single-pass', skills: [] },
        [{ id: 'case', expectation: 'must_find', anchor: fixture.anchor, fixtureId: fixture.id, fixtureHash: fixtureHash(fixture) }]);
      expect(reviewed).toMatchObject({ status: 'completed', score: { recall: 0 } });
      const modified = Buffer.concat([bytes, Buffer.from('\n// modified')]);
      await writeFile(artifact, modified);
      expect(await loadEvalEngine(artifact, manifest)).toBeNull();
      await writeFile(manifest, JSON.stringify({ sha256: createHash('sha256').update(modified).digest('hex') }));
      expect((await loadEvalEngine(artifact, manifest))?.version).not.toBe(loaded!.version);
      expect(await loadEvalEngine(join(directory, 'missing'), manifest)).toBeNull();
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 30_000);
});
