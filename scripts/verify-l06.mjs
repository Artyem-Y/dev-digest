// DevDigest's local L06 gate; this is not the course-provided verifier.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
function run(command, args, cwd = root, env = process.env, rejectSkipped = false) {
  process.stdout.write(`\n[l06] ${command} ${args.join(' ')} (${cwd})\n`);
  const result = spawnSync(command, args, { cwd, env, stdio: rejectSkipped ? 'pipe' : 'inherit', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (rejectSkipped) { process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}`);
  if (rejectSkipped && /\bskipped\b|↓\s+test\//i.test(`${result.stdout}\n${result.stderr}`)) throw new Error(`${command} skipped an integration test`);
}
const clientEnv = join(root, 'client/next-env.d.ts');
const originalNextEnv = readFileSync(clientEnv, 'utf8');
try {
  const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { cwd: root, encoding: 'utf8' });
  if (docker.error || docker.status !== 0 || !/^\d+\.\d+/m.test(docker.stdout ?? '')) throw new Error('Docker server is unavailable');
  process.stdout.write(`[l06] Docker server ${docker.stdout.trim()}\n`);
  run('corepack', ['pnpm', 'typecheck'], join(root, 'server'));
  run('corepack', ['pnpm', 'exec', 'vitest', 'run', 'test/eval-score.test.ts', 'test/eval-dataset.test.ts', 'test/eval-suite-snapshot.test.ts', 'test/eval-run-suite.test.ts'], join(root, 'server'));
  // Each integration lane runs separately; a skipped Docker lane is not a pass.
  for (const test of ['test/eval-cases.it.test.ts', 'test/eval-migration.it.test.ts', 'test/agents-versions.it.test.ts']) {
    run('corepack', ['pnpm', 'exec', 'vitest', 'run', test, '--reporter=verbose'], join(root, 'server'), process.env, true);
  }
  run('corepack', ['pnpm', 'typecheck'], join(root, 'client'));
  run('corepack', ['pnpm', 'exec', 'vitest', 'run', 'src/components/evals/EvalsTab.test.tsx', 'src/components/evals/EvalDashboard.test.tsx', 'src/components/evals/EvalDashboard.states.test.tsx'], join(root, 'client'));
  run('npm', ['run', 'typecheck'], join(root, 'e2e'));
  run('./scripts/e2e.sh', [], root, { ...process.env, E2E_FLOW: '15-eval-pipeline.flow.json' });
  process.stdout.write('\n[l06] Local deterministic gate passed. Real-provider sensitivity and eight real findings are separate acceptance evidence.\n');
} catch (error) {
  process.stderr.write(`\n[l06] Failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  // Next rewrites this generated declaration when the hermetic build runs.
  const current = readFileSync(clientEnv, 'utf8');
  if (current === originalNextEnv.replace('./.next/types/routes.d.ts', './.next-e2e/types/routes.d.ts')) writeFileSync(clientEnv, originalNextEnv);
}
