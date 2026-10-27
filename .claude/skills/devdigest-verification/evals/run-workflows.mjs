import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { gradeWorkflow } from './grade-workflow.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillsRoot = path.resolve(here, '../..');

function argsFrom(argv) {
  const args = { runs: 1, concurrency: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--live') args.live = true;
    else if (argv[index] === '--workflow') args.workflow = argv[++index];
    else if (argv[index] === '--runs') args.runs = Number(argv[++index]);
    else if (argv[index] === '--output') args.output = argv[++index];
  }
  return args;
}

function execute(command, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { clearTimeout(timer); resolve({ exitCode: null, stdout, stderr: `${stderr}${error.message}`, timedOut }); });
    child.on('close', (exitCode) => { clearTimeout(timer); resolve({ exitCode, stdout, stderr, timedOut }); });
  });
}

async function runOne({ workflow, arm, index, output }) {
  const fixture = path.join(here, workflow.fixture);
  const expected = JSON.parse(await readFile(path.join(here, workflow.expected), 'utf8'));
  const sandbox = await mkdtemp(path.join(tmpdir(), `devdigest-${workflow.id}-${arm}-${index}-`));
  const repository = path.join(sandbox, 'repo');
  await cp(fixture, repository, { recursive: true, filter: (source) => path.basename(source) !== 'expected.json' });
  await cp(path.join(here, 'public-completion-contract.md'), path.join(repository, 'public-completion-contract.md'));
  const initialImmutable = Object.fromEntries(await Promise.all((expected.immutable_paths || []).map(async (item) => [item, await readFile(path.join(repository, item), 'utf8')])));
  if (arm === 'candidate') {
    for (const skill of workflow.candidate_skills) {
      const source = path.join(skillsRoot, skill);
      await cp(source, path.join(repository, '.codex/skills', skill), { recursive: true });
      await cp(source, path.join(repository, '.claude/skills', skill), { recursive: true });
    }
  }
  const task = [
    arm === 'candidate' ? `Use ${workflow.candidate_skills.map((skill) => `$${skill}`).join(', ')} for this task.` : 'Do not use any project skills for this task.',
    workflow.prompt,
    'Read public-completion-contract.md and write result/completion.json after making the source changes.',
  ].join('\n\n');
  const modelArgs = process.env.EVAL_MODEL ? ['--model', process.env.EVAL_MODEL] : [];
  const execution = await execute(process.env.CODEX_BIN || 'codex', ['exec', '--json', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'workspace-write', ...modelArgs, task], repository, 10 * 60 * 1000);
  const grade = await gradeWorkflow({ root: repository, expected, initialImmutable });
  const runDirectory = path.join(output, workflow.id, arm, String(index));
  await mkdir(runDirectory, { recursive: true });
  await writeFile(path.join(runDirectory, 'trace.jsonl'), execution.stdout);
  await writeFile(path.join(runDirectory, 'stderr.txt'), execution.stderr);
  await cp(repository, path.join(runDirectory, 'workspace'), {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}.codex${path.sep}`) && !source.includes(`${path.sep}.claude${path.sep}`),
  });
  const valid = execution.exitCode === 0 && !execution.timedOut;
  const failurePhase = valid
    ? (grade.pass ? null : 'grading')
    : execution.timedOut ? 'timeout'
      : !execution.stdout ? 'codex_startup'
        : 'agent_execution';
  await writeFile(path.join(runDirectory, 'result.json'), `${JSON.stringify({
    arm, index, exit_code: execution.exitCode, timed_out: execution.timedOut,
    valid, status: valid ? (grade.pass ? 'passed' : 'graded_failure') : 'infrastructure_failure',
    failure_phase: failurePhase,
    grade,
  }, null, 2)}\n`);
  await rm(sandbox, { recursive: true, force: true });
  return { arm, index, valid, grade, failure_phase: failurePhase };
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (!args.live || !args.output || !args.workflow) throw new Error('Usage: --live --workflow <id> --output <directory> [--runs <n>]');
  const manifest = JSON.parse(await readFile(path.join(here, 'composite-workflows.json'), 'utf8'));
  const workflow = manifest.workflows.find((item) => item.id === args.workflow);
  if (!workflow) throw new Error(`Unknown workflow: ${args.workflow}`);
  const output = path.resolve(args.output);
  const results = [];
  for (const arm of ['baseline', 'candidate']) for (let index = 1; index <= args.runs; index += 1) results.push(await runOne({ workflow, arm, index, output }));
  const summary = Object.fromEntries(['baseline', 'candidate'].map((arm) => {
    const armRuns = results.filter((item) => item.arm === arm);
    const valid = armRuns.filter((item) => item.valid);
    return [arm, { attempted_runs: armRuns.length, valid_runs: valid.length, pass_rate: valid.length ? valid.filter((item) => item.grade.pass).length / valid.length : null }];
  }));
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'benchmark.json'), `${JSON.stringify({ workflow: workflow.id, ...summary, results }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ workflow: workflow.id, ...summary }, null, 2)}\n`);
  if (results.some((result) => !result.valid)) {
    process.stderr.write('One or more workflow eval runs had an infrastructure failure.\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
