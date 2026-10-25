import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { isEligibleMarkdownPath, normalizeProjectPath } from '../src/modules/project-context/domain/path-policy.js';
import { GitTrackedDocumentStore } from '../src/modules/project-context/infrastructure/git-tracked-document-store.js';

const execFileAsync = promisify(execFile);

describe('Project Context path policy', () => {
  it.each(['/absolute.md', '../escape.md', 'docs/../escape.md', 'NUL\0.md', 'C:\\escape.md'])(
    'rejects unsafe repository-relative path %j',
    (path) => expect(normalizeProjectPath(path)).toBeNull(),
  );

  it('normalizes only tracked Markdown candidates', () => {
    expect(normalizeProjectPath('docs//product.md')).toBe('docs/product.md');
    expect(isEligibleMarkdownPath('docs/product.MD')).toBe(true);
    expect(isEligibleMarkdownPath('guides/node_modules/readme.md')).toBe(false);
    expect(isEligibleMarkdownPath('guides/.git/readme.md')).toBe(false);
    expect(isEligibleMarkdownPath('.git/notes.md')).toBe(false);
    expect(isEligibleMarkdownPath('docs/plan.txt')).toBe(false);
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
      const store = new GitTrackedDocumentStore(root);
      await expect(store.catalog()).resolves.toEqual(['docs/escape.md']);
      await expect(store.read('docs/escape.md')).resolves.toEqual({ path: 'docs/escape.md', reason: 'no_longer_eligible' });
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { force: true });
    }
  });

  it('fail-closes when a valid target is swapped to an external symlink after realpath validation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devdigest-project-context-race-'));
    const outside = join(root, '..', 'outside-project-context-race.md');
    try {
      await mkdir(join(root, 'docs'));
      await writeFile(join(root, 'docs', 'brief.md'), 'safe');
      await writeFile(outside, 'private');
      await execFileAsync('git', ['-C', root, 'init']);
      await execFileAsync('git', ['-C', root, 'add', 'docs/brief.md']);
      const store = new GitTrackedDocumentStore(root, async () => {
        await rm(join(root, 'docs', 'brief.md'));
        await symlink(outside, join(root, 'docs', 'brief.md'));
      });
      await expect(store.read('docs/brief.md')).resolves.toEqual({ path: 'docs/brief.md', reason: 'no_longer_eligible' });
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { force: true });
    }
  });
});
