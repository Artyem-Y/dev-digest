import { access, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const skillRoot = '.claude/skills';
const compositeManifest = `${skillRoot}/devdigest-verification/evals/composite-workflows.json`;

function parseArgs(argv) {
  const values = { changedFiles: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--changed-file') values.changedFiles.push(argv[++index]);
    else if (argument === '--base') values.base = argv[++index];
    else if (argument === '--head') values.head = argv[++index];
    else if (argument === '--output') values.output = argv[++index];
    else if (argument === '--all-known') values.allKnown = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return values;
}

async function fileExists(target) {
  try {
    await access(path.join(root, target));
    return true;
  } catch {
    return false;
  }
}

async function changedFiles(args) {
  if (args.changedFiles.length) return args.changedFiles;
  if (!args.base || !args.head) throw new Error('Pass --changed-file, --base/--head, or --all-known.');
  const { stdout } = await execFileAsync('git', ['diff', '--name-only', `${args.base}...${args.head}`], { cwd: root });
  return stdout.split('\n').map((entry) => entry.trim()).filter(Boolean);
}

function addSkip(selection, owner, reason) {
  if (!selection.skipped.some((item) => item.owner === owner && item.reason === reason)) {
    selection.skipped.push({ owner, reason });
  }
}

function addRunnable(selection, kind, id) {
  if (!selection.runnable.some((item) => item.kind === kind && item.id === id)) {
    selection.runnable.push({ kind, id });
  }
}

async function select() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(path.join(root, compositeManifest), 'utf8'));
  const workflows = new Set(manifest.workflows.map((workflow) => workflow.id));
  const selection = { changed_files: [], runnable: [], skipped: [] };
  const changed = args.allKnown ? [skillRoot, '.claude/agents'] : await changedFiles(args);
  selection.changed_files = changed;

  const chooseWorkflow = (id) => addRunnable(selection, 'composite-workflow', id);
  const chooseAllWorkflows = () => workflows.forEach(chooseWorkflow);
  for (const changedPath of changed) {
    if (changedPath === 'AGENTS.md' || changedPath === 'CLAUDE.md') chooseAllWorkflows();
    if (changedPath.startsWith('client/AGENTS.md')) chooseWorkflow('client-contract-change');
    if (changedPath.startsWith('server/AGENTS.md')) {
      chooseWorkflow('server-safe-module-change');
      chooseWorkflow('persistence-and-verification');
    }
    if (changedPath.startsWith('reviewer-core/AGENTS.md') || changedPath.startsWith('e2e/AGENTS.md')) chooseAllWorkflows();
    if (changedPath.startsWith(`${skillRoot}/devdigest-verification/`)) chooseAllWorkflows();

    const skillMatch = changedPath.match(/^\.claude\/skills\/([^/]+)\//);
    if (skillMatch && skillMatch[1] !== 'devdigest-verification') {
      const skill = skillMatch[1];
      const runner = `${skillRoot}/${skill}/evals/run-evals.mjs`;
      const evalDirectory = `${skillRoot}/${skill}/evals`;
      if (await fileExists(runner)) addRunnable(selection, 'skill', skill);
      else if (await fileExists(evalDirectory)) addSkip(selection, `skill:${skill}`, 'eval fixtures exist but no executable runner is configured');
      else addSkip(selection, `skill:${skill}`, 'no evals directory');
    }

    const agentMatch = changedPath.match(/^(?:\.claude|\.agents)\/agents\/([^/]+)\.md$/);
    if (agentMatch) addSkip(selection, `agent:${agentMatch[1]}`, 'no agent eval is configured');
  }
  if (args.allKnown) {
    if (await fileExists(`${skillRoot}/dependencies-checker/evals/run-evals.mjs`)) addRunnable(selection, 'skill', 'dependencies-checker');
  }

  for (const item of selection.skipped) {
    process.stdout.write(`::notice title=Eval skipped::${item.owner}: ${item.reason}\n`);
  }
  for (const item of selection.runnable) {
    process.stdout.write(`::notice title=Eval selected::${item.kind}:${item.id}\n`);
  }
  if (args.output) await writeFile(path.resolve(root, args.output), `${JSON.stringify(selection, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(selection)}\n`);
}

select().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
