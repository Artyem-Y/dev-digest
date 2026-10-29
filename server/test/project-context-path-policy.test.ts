import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { isEligibleMarkdownPath, normalizeProjectPath } from '../src/modules/project-context/domain/path-policy.js';
import { GitTrackedDocumentStore } from '../src/modules/project-context/infrastructure/git-tracked-document-store.js';

const execFileAsync = promisify(execFile);
async function commitMain(root: string) {
  await execFileAsync('git', ['-C', root, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
  await execFileAsync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']);
}

describe('Project Context path policy', () => {
  it.each(['/absolute.md', '../escape.md', 'docs/../escape.md', 'NUL\0.md', 'C:\\escape.md'])(
    'rejects unsafe repository-relative path %j',
    (path) => expect(normalizeProjectPath(path)).toBeNull(),
  );

  it('normalizes only tracked Markdown candidates', () => {
    expect(normalizeProjectPath('docs//product.md')).toBe('docs/product.md');
    expect(isEligibleMarkdownPath('docs/product.MD')).toBe(true);
    expect(isEligibleMarkdownPath('docs/product.markdown')).toBe(false);
    expect(isEligibleMarkdownPath('README.md')).toBe(false);
    expect(isEligibleMarkdownPath('packages/payments/specs/api/rules.md')).toBe(true);
    expect(isEligibleMarkdownPath('packages/payments/insights/notes.md')).toBe(true);
    expect(isEligibleMarkdownPath('client/INSIGHTS.md')).toBe(true);
    expect(isEligibleMarkdownPath('INSIGHTS.md')).toBe(true);
    expect(isEligibleMarkdownPath('client/INSIGHTS.md', ['handbook'])).toBe(false);
    expect(isEligibleMarkdownPath('handbook/team/rules.md')).toBe(false);
    expect(isEligibleMarkdownPath('handbook/team/rules.md', ['handbook'])).toBe(true);
    expect(isEligibleMarkdownPath('handbook/team/rules.md', ['handbook/team'])).toBe(true);
    expect(isEligibleMarkdownPath('guides/node_modules/readme.md')).toBe(false);
    expect(isEligibleMarkdownPath('guides/.git/readme.md')).toBe(false);
    expect(isEligibleMarkdownPath('.git/notes.md')).toBe(false);
    expect(isEligibleMarkdownPath('docs/plan.txt')).toBe(false);
  });

  it('reads a tracked regular Markdown file inside the checkout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devdigest-project-context-valid-'));
    try {
      await mkdir(join(root, 'docs'));
      await writeFile(join(root, 'docs', 'brief.md'), '# Tracked document');
      await writeFile(join(root, 'docs', 'guide.markdown'), '# Markdown document');
      await writeFile(join(root, 'README.md'), '# Outside configured roots');
      await writeFile(join(root, 'INSIGHTS.md'), '# Insights');
      await execFileAsync('git', ['-C', root, 'init']);
      await execFileAsync('git', ['-C', root, 'add', 'docs/brief.md', 'docs/guide.markdown', 'README.md', 'INSIGHTS.md']);
      await commitMain(root);
      const store = new GitTrackedDocumentStore(root);
      expect(await store.catalog()).toEqual(expect.arrayContaining(['docs/brief.md', 'INSIGHTS.md']));
      await expect(store.read('INSIGHTS.md')).resolves.toEqual({ path: 'INSIGHTS.md', content: '# Insights' });
      await expect(store.read('docs/brief.md')).resolves.toEqual({ path: 'docs/brief.md', content: '# Tracked document' });
      await expect(store.read('docs/guide.markdown')).resolves.toEqual({ path: 'docs/guide.markdown', reason: 'no_longer_eligible' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('uses configured roots at any depth and excludes default roots when overridden', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devdigest-project-context-custom-'));
    try {
      await mkdir(join(root, 'packages', 'handbook', 'api'), { recursive: true });
      await mkdir(join(root, 'docs'));
      await writeFile(join(root, 'packages', 'handbook', 'api', 'rules.md'), '# Rules');
      await writeFile(join(root, 'docs', 'outside.md'), '# Outside');
      await execFileAsync('git', ['-C', root, 'init']);
      await execFileAsync('git', ['-C', root, 'add', 'packages/handbook/api/rules.md', 'docs/outside.md']);
      await commitMain(root);
      const store = new GitTrackedDocumentStore(root, ['handbook']);
      await expect(store.catalog()).resolves.toEqual(['packages/handbook/api/rules.md']);
      await expect(store.read('docs/outside.md')).resolves.toEqual({ path: 'docs/outside.md', reason: 'no_longer_eligible' });
      await expect(store.read('packages/handbook/api/rules.md')).resolves.toEqual({ path: 'packages/handbook/api/rules.md', content: '# Rules' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('reads committed main documents even when another branch and uncommitted changes are checked out', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devdigest-project-context-main-'));
    try {
      await execFileAsync('git', ['-C', root, 'init']);
      await execFileAsync('git', ['-C', root, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
      await mkdir(join(root, 'docs'));
      await writeFile(join(root, 'docs', 'main.md'), '# Main version');
      await execFileAsync('git', ['-C', root, 'add', 'docs/main.md']);
      await execFileAsync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'main']);
      await execFileAsync('git', ['-C', root, 'checkout', '-b', 'other']);
      await writeFile(join(root, 'docs', 'main.md'), '# Changed on another branch');
      await writeFile(join(root, 'docs', 'other.md'), '# Only on other branch');
      await execFileAsync('git', ['-C', root, 'add', 'docs/main.md', 'docs/other.md']);
      await execFileAsync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'other']);
      await writeFile(join(root, 'docs', 'main.md'), '# Uncommitted change');
      const store = new GitTrackedDocumentStore(root);
      await expect(store.catalog()).resolves.toEqual(['docs/main.md']);
      await expect(store.read('docs/main.md')).resolves.toEqual({ path: 'docs/main.md', content: '# Main version' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('keeps one main snapshot for a catalog while a later run sees the updated commit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devdigest-project-context-main-snapshot-'));
    try {
      await execFileAsync('git', ['-C', root, 'init']);
      await mkdir(join(root, 'docs'));
      await writeFile(join(root, 'docs', 'rules.md'), '# Before');
      await execFileAsync('git', ['-C', root, 'add', 'docs/rules.md']);
      await commitMain(root);
      const first = new GitTrackedDocumentStore(root);
      await first.catalog();
      await writeFile(join(root, 'docs', 'rules.md'), '# After');
      await execFileAsync('git', ['-C', root, 'add', 'docs/rules.md']);
      await execFileAsync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'updated']);
      await expect(first.read('docs/rules.md')).resolves.toEqual({ path: 'docs/rules.md', content: '# Before' });
      await expect(new GitTrackedDocumentStore(root).read('docs/rules.md')).resolves.toEqual({ path: 'docs/rules.md', content: '# After' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('does not read a Git-tracked symlink whose real path escapes the checkout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devdigest-project-context-'));
    const outside = join(root, '..', 'outside-project-context.md');
    try {
      await mkdir(join(root, 'docs'));
      await writeFile(outside, 'private');
      await symlink(outside, join(root, 'docs', 'escape.md'));
      await execFileAsync('git', ['-C', root, 'init']);
      await execFileAsync('git', ['-C', root, 'add', 'docs/escape.md']);
      await commitMain(root);
      const store = new GitTrackedDocumentStore(root);
      await expect(store.catalog()).resolves.toEqual(['docs/escape.md']);
      await expect(store.read('docs/escape.md')).resolves.toEqual({ path: 'docs/escape.md', reason: 'no_longer_eligible' });
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { force: true });
    }
  });

  it('reads the committed blob when the worktree file is replaced by an external symlink', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devdigest-project-context-race-'));
    const outside = join(root, '..', 'outside-project-context-race.md');
    try {
      await mkdir(join(root, 'docs'));
      await writeFile(join(root, 'docs', 'brief.md'), 'safe');
      await writeFile(outside, 'private');
      await execFileAsync('git', ['-C', root, 'init']);
      await execFileAsync('git', ['-C', root, 'add', 'docs/brief.md']);
      await commitMain(root);
      const store = new GitTrackedDocumentStore(root);
      await store.catalog();
      await rm(join(root, 'docs', 'brief.md'));
      await symlink(outside, join(root, 'docs', 'brief.md'));
      await expect(store.read('docs/brief.md')).resolves.toEqual({ path: 'docs/brief.md', content: 'safe' });
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { force: true });
    }
  });

  it('reads the committed blob when a worktree parent is replaced by an external symlink', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devdigest-project-context-parent-'));
    const outside = await mkdtemp(join(tmpdir(), 'devdigest-project-context-outside-'));
    try {
      await mkdir(join(root, 'docs'));
      await writeFile(join(root, 'docs', 'brief.md'), 'safe');
      await writeFile(join(outside, 'brief.md'), 'private');
      await execFileAsync('git', ['-C', root, 'init']);
      await execFileAsync('git', ['-C', root, 'add', 'docs/brief.md']);
      await commitMain(root);
      const store = new GitTrackedDocumentStore(root);
      await store.catalog();
      await rename(join(root, 'docs'), join(root, 'original-docs'));
      await symlink(outside, join(root, 'docs'));
      await expect(store.read('docs/brief.md')).resolves.toEqual({ path: 'docs/brief.md', content: 'safe' });
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
