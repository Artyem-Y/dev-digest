import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { gradeReport } from './grade-report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '..');
const fixtureRoot = path.join(here, 'fixtures/repo');

function stats(values) {
  if (!values.length) return { mean: 0, min: 0, max: 0, stddev: 0 };
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return { mean, min: Math.min(...values), max: Math.max(...values), stddev: Math.sqrt(variance) };
}

function armStats(runs) {
  const validRuns = runs.filter((run) => run.valid);
  const passes = validRuns.filter((run) => run.grade?.pass).length;
  return {
    attempted_runs: runs.length,
    valid_runs: validRuns.length,
    infra_failures: runs.length - validRuns.length,
    pass_rate: validRuns.length ? passes / validRuns.length : null,
    tokens: stats(validRuns.map((run) => run.tokens || 0)),
    duration_ms: stats(validRuns.map((run) => run.elapsed_ms || 0)),
  };
}

export function aggregate({ baseline, candidate }) {
  const baselineStats = armStats(baseline);
  const candidateStats = armStats(candidate);
  return {
    baseline: baselineStats,
    candidate: candidateStats,
    delta: {
      pass_rate: baselineStats.pass_rate === null || candidateStats.pass_rate === null
        ? null
        : candidateStats.pass_rate - baselineStats.pass_rate,
      tokens_mean: candidateStats.tokens.mean - baselineStats.tokens.mean,
      duration_ms_mean: candidateStats.duration_ms.mean - baselineStats.duration_ms.mean,
    },
  };
}

function parseTokens(jsonl) {
  let total = 0;
  for (const line of jsonl.split('\n')) {
    try {
      const event = JSON.parse(line);
      const usage = event?.response?.usage || event?.usage || event?.item?.usage;
      if (usage && Number.isFinite(usage.total_tokens)) total += usage.total_tokens;
      else if (usage) total += (usage.input_tokens || 0) + (usage.output_tokens || 0);
    } catch {
      // A non-JSON diagnostic cannot contribute token data.
    }
  }
  return total;
}

function runCommand(command, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `${path.dirname(process.execPath)}:${process.env.PATH || ''}`,
      },
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ...result, timed_out: timedOut });
    };
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => finish({ exit_code: null, stdout, stderr: `${stderr}${error.message}` }));
    child.on('close', (exitCode) => finish({ exit_code: exitCode, stdout, stderr }));
  });
}

async function runOne({ arm, index, output, prompt, expected }) {
  const sandbox = await mkdtemp(path.join(tmpdir(), `dependencies-checker-${arm}-${index}-`));
  const repository = path.join(sandbox, 'repo');
  const resultDirectory = path.join(repository, 'result');
  await cp(fixtureRoot, repository, { recursive: true });
  await cp(path.join(here, 'public-report-contract.md'), path.join(repository, 'public-report-contract.md'));
  await mkdir(resultDirectory, { recursive: true });
  const gitSetup = await runCommand('git', ['init', '--quiet'], repository, 10_000);
  if (gitSetup.exit_code !== 0) throw new Error(`Could not initialize eval fixture Git repository: ${gitSetup.stderr}`);
  if (arm === 'candidate') {
    await cp(skillRoot, path.join(repository, '.claude/skills/dependencies-checker'), {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}fixtures${path.sep}`),
    });
    await cp(skillRoot, path.join(repository, '.codex/skills/dependencies-checker'), {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}fixtures${path.sep}`),
    });
  }
  const task = [
    arm === 'candidate' ? 'Use $dependencies-checker for this task.' : 'Do not use any project skill for this task.',
    prompt,
    'Write JSON to result/dependency-report.json and Markdown to result/dependency-report.md.',
  ].join('\n\n');
  const started = performance.now();
  const command = process.env.CODEX_BIN || 'codex';
  const modelArgs = process.env.EVAL_MODEL ? ['--model', process.env.EVAL_MODEL] : [];
  const execution = await runCommand(command, [
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    'workspace-write',
    ...modelArgs,
    task,
  ], repository, 10 * 60 * 1000);
  const elapsed_ms = Math.round(performance.now() - started);
  const runDirectory = path.join(output, arm, String(index));
  await mkdir(runDirectory, { recursive: true });
  await writeFile(path.join(runDirectory, 'trace.jsonl'), execution.stdout);
  await writeFile(path.join(runDirectory, 'stderr.txt'), execution.stderr);
  let report = null;
  let report_error = null;
  let markdown_written = false;
  try {
    report = JSON.parse(await readFile(path.join(resultDirectory, 'dependency-report.json'), 'utf8'));
  } catch (error) {
    report_error = error.message;
    // Missing output is represented as a failed deterministic grade.
  }
  if (report) {
    await cp(path.join(resultDirectory, 'dependency-report.json'), path.join(runDirectory, 'dependency-report.json'));
    const markdownPath = path.join(resultDirectory, 'dependency-report.md');
    markdown_written = await fileExists(markdownPath);
    if (markdown_written) await cp(markdownPath, path.join(runDirectory, 'dependency-report.md'));
  }
  const valid = execution.exit_code === 0 && !execution.timed_out && Boolean(report) && markdown_written;
  const infrastructure_failure = valid
    ? null
    : execution.timed_out
      ? 'timeout'
      : execution.exit_code !== 0
        ? 'process_failed'
        : !report
          ? 'json_report_missing_or_invalid'
          : 'markdown_report_missing';
  const grade = valid
    ? gradeReport(report, expected)
    : null;
  const result = {
    arm,
    index,
    exit_code: execution.exit_code,
    elapsed_ms,
    tokens: parseTokens(execution.stdout),
    report_written: Boolean(report),
    markdown_written,
    report_error,
    timed_out: execution.timed_out,
    valid,
    infrastructure_failure,
    grade,
  };
  await writeFile(path.join(runDirectory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await rm(sandbox, { recursive: true, force: true });
  return result;
}

async function fileExists(target) {
  try {
    await readFile(target);
    return true;
  } catch {
    return false;
  }
}

async function judgeRun({ runDirectory, outputSchema }) {
  const prompt = [
    'Act only as a read-only evaluator.',
    'Read dependency-report.json and dependency-report.md in the current directory.',
    'Judge whether the Markdown is understandable to developers and every recommendation is grounded in the JSON evidence.',
    'Return only the requested schema. Do not edit files or run dependency commands.',
  ].join(' ');
  const command = process.env.CODEX_BIN || 'codex';
  const modelArgs = process.env.EVAL_JUDGE_MODEL || process.env.EVAL_MODEL
    ? ['--model', process.env.EVAL_JUDGE_MODEL || process.env.EVAL_MODEL]
    : [];
  const responsePath = path.join(runDirectory, 'judge.json');
  const execution = await runCommand(command, [
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    'workspace-write',
    ...modelArgs,
    '--output-schema',
    outputSchema,
    '-o',
    responsePath,
    prompt,
  ], runDirectory, 2 * 60 * 1000);
  await writeFile(path.join(runDirectory, 'judge-trace.jsonl'), execution.stdout);
  await writeFile(path.join(runDirectory, 'judge-stderr.txt'), execution.stderr);
  try {
    return {
      exit_code: execution.exit_code,
      result: JSON.parse(await readFile(responsePath, 'utf8')),
    };
  } catch {
    return { exit_code: execution.exit_code, result: null };
  }
}

function argumentsFrom(argv) {
  const values = { runs: 5, concurrency: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--live') values.live = true;
    else if (argument === '--judge') values.judge = true;
    else if (argument === '--runs') values.runs = Number(argv[++index]);
    else if (argument === '--concurrency') values.concurrency = Number(argv[++index]);
    else if (argument === '--output') values.output = argv[++index];
  }
  return values;
}

async function main() {
  const args = argumentsFrom(process.argv.slice(2));
  if (!args.live) {
    throw new Error('Refusing model calls by default. Re-run with --live after approving the evaluation cost.');
  }
  if (!Number.isInteger(args.runs) || args.runs < 1) throw new Error('--runs must be a positive integer');
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1) throw new Error('--concurrency must be a positive integer');
  if (!args.output) throw new Error('--output is required');
  const output = path.resolve(args.output);
  const prompt = await readFile(path.join(here, 'prompt.txt'), 'utf8');
  const expected = JSON.parse(await readFile(path.join(here, 'expected.json'), 'utf8'));
  await mkdir(output, { recursive: true });
  const jobs = ['baseline', 'candidate'].flatMap((arm) =>
    Array.from({ length: args.runs }, (_, offset) => ({ arm, index: offset + 1 })),
  );
  const completed = [];
  for (let start = 0; start < jobs.length; start += args.concurrency) {
    const batch = jobs.slice(start, start + args.concurrency);
    completed.push(...await Promise.all(batch.map(async ({ arm, index }) => {
      const run = await runOne({ arm, index, output, prompt, expected });
      if (args.judge && run.valid) {
        run.judge = await judgeRun({
          runDirectory: path.join(output, arm, String(index)),
          outputSchema: path.join(here, 'rubric.schema.json'),
        });
      }
      return run;
    })));
  }
  const results = {
    baseline: completed.filter((run) => run.arm === 'baseline').sort((left, right) => left.index - right.index),
    candidate: completed.filter((run) => run.arm === 'candidate').sort((left, right) => left.index - right.index),
  };
  const benchmark = { ...aggregate(results), results };
  await writeFile(path.join(output, 'benchmark.json'), `${JSON.stringify(benchmark, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(benchmark, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
