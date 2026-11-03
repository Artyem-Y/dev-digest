import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { gradeWorkflow } from './grade-workflow.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

async function setup(id) {
  const root = await mkdtemp(path.join(tmpdir(), `workflow-eval-${id}-`));
  const fixture = path.join(here, 'fixtures', id);
  await cp(fixture, root, { recursive: true });
  const expected = JSON.parse(await readFile(path.join(root, 'expected.json'), 'utf8'));
  const initialImmutable = Object.fromEntries(await Promise.all((expected.immutable_paths || []).map(async (relativePath) => [
    relativePath,
    await readFile(path.join(root, relativePath), 'utf8'),
  ])));
  return { root, expected, initialImmutable };
}

async function writeCompleteClient(root) {
  await writeFile(path.join(root, 'server/src/vendor/shared/pulls.ts'), "export const PullDetail = z.object({ reviewSummary: z.string().nullable() });\n");
  await writeFile(path.join(root, 'client/src/vendor/shared/pulls.ts'), "export const PullDetail = z.object({ reviewSummary: z.string().nullable() });\n");
  await writeFile(path.join(root, 'client/src/lib/api.ts'), 'export type PullDetail = { reviewSummary: string | null };\n');
  await writeFile(path.join(root, 'client/messages/en/pulls.json'), '{"summary":"Review summary"}\n');
}

async function writeCompleteServer(root) {
  await mkdir(path.join(root, 'server/src/modules/pulls/application/ports'), { recursive: true });
  await writeFile(path.join(root, 'server/src/modules/pulls/routes.ts'), 'const scope = requireScope(request); return getPullSummary(scope.workspaceId);\n');
  await writeFile(path.join(root, 'server/src/modules/pulls/application/get-pull-summary.ts'), 'import type { PullSummaryReader } from "./ports/pull-summary-reader";\n');
  await writeFile(path.join(root, 'server/src/modules/pulls/application/ports/pull-summary-reader.ts'), 'export interface PullSummaryReader { get(workspaceId: string): Promise<string | null> }\n');
}

async function writeCompletePersistence(root) {
  await writeFile(path.join(root, 'server/src/db/schema/pulls.ts'), "export const pulls = { reviewSummary: text('review_summary') };\n");
  await writeFile(path.join(root, 'server/src/db/migrations/0002_add_pull_review_summary.sql'), 'alter table pulls add column review_summary text;\n');
  await writeFile(path.join(root, 'server/src/modules/pulls/repository.it.test.ts'), 'it("stores reviewSummary", () => {});\n');
}

const writers = {
  'client-contract-change': writeCompleteClient,
  'server-safe-module-change': writeCompleteServer,
  'persistence-and-verification': writeCompletePersistence,
};

for (const id of Object.keys(writers)) {
  test(`${id} accepts a complete workspace and receipt`, async () => {
    const { root, expected, initialImmutable } = await setup(id);
    try {
      await writers[id](root);
      await mkdir(path.join(root, 'result'), { recursive: true });
      await writeFile(path.join(root, 'result/completion.json'), `${JSON.stringify({
        changed_paths: expected.required_paths,
        verification: (expected.verification || (expected.verification_commands || []).map((command_fragment) => ({ command_fragment })))
          .map(({ command_fragment }) => ({ command: command_fragment, status: 'passed', scope: 'fixture' })),
        environment_blocks: [],
      })}\n`);
      assert.equal((await gradeWorkflow({ root, expected, initialImmutable })).pass, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('rejects an omitted required invariant', async () => {
  const { root, expected, initialImmutable } = await setup('server-safe-module-change');
  try {
    await writeCompleteServer(root);
    await mkdir(path.join(root, 'result'), { recursive: true });
    await writeFile(path.join(root, 'result/completion.json'), JSON.stringify({
      changed_paths: expected.required_paths,
      verification: [{ command: 'pnpm exec vitest run', status: 'passed', scope: 'fixture' }],
      environment_blocks: [],
    }));
    await rm(path.join(root, 'server/src/modules/pulls/application/ports/pull-summary-reader.ts'));
    assert.equal((await gradeWorkflow({ root, expected, initialImmutable })).pass, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
