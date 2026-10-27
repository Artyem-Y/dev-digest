import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), 'run-evals.mjs');

test('exits nonzero when every Codex invocation is an infrastructure failure', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'dependencies-runner-test-'));
  const codex = path.join(temporary, 'failing-codex');
  const output = path.join(temporary, 'output');
  await writeFile(codex, '#!/usr/bin/env node\nprocess.exit(9);\n');
  await chmod(codex, 0o755);

  try {
    await assert.rejects(
      execFileAsync(process.execPath, [runner, '--live', '--runs', '1', '--output', output], {
        env: { ...process.env, CODEX_BIN: codex },
      }),
      (error) => error.code === 1,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
