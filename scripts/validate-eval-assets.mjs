import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const skillsRoot = path.join(root, '.claude/skills');
const required = ['composite-workflows.json', 'public-completion-contract.md', 'grade-workflow.mjs', 'run-workflows.mjs'];
for (const name of required) await access(path.join(skillsRoot, 'devdigest-verification/evals', name));

const entries = await readdir(skillsRoot, { withFileTypes: true });
for (const entry of entries.filter((item) => item.isDirectory())) {
  const skill = path.join(skillsRoot, entry.name);
  try { await access(path.join(skill, 'SKILL.md')); } catch { throw new Error(`Skill ${entry.name} has no SKILL.md`); }
}

const manifestPath = path.join(skillsRoot, 'devdigest-verification/evals/composite-workflows.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const workflow of manifest.workflows) {
  for (const target of [workflow.fixture, workflow.expected]) await access(path.join(path.dirname(manifestPath), target));
  const expected = JSON.parse(await readFile(path.join(path.dirname(manifestPath), workflow.expected), 'utf8'));
  if (!Array.isArray(expected.required_paths) || expected.required_paths.length === 0) throw new Error(`${workflow.id} has no required paths`);
}
console.log(`Validated ${manifest.workflows.length} composite workflows.`);
