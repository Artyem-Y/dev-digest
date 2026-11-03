import { describe, expect, it, vi } from 'vitest';
import { loadDiff } from '../src/modules/reviews/diff-loader.js';
import { parseUnifiedDiff } from '../src/adapters/git/diff-parser.js';

const base = 'a'.repeat(40), head = 'b'.repeat(40);
const diff = parseUnifiedDiff('diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -0,0 +1 @@\n+x\n');
const pull = { id: 'p', base: 'main', headSha: head } as never;
const repo = { owner: 'o', name: 'r' };
describe('review diff revision capture', () => {
  it('resolves refs before diff so moved refs cannot alter review provenance', async () => {
    const git = { resolveRevision: vi.fn(async (_repo, ref) => ref === 'main' ? base : head), diff: vi.fn().mockResolvedValue(diff) };
    const loaded = await loadDiff(git, {} as never, 'w', pull, repo);
    expect(git.diff).toHaveBeenCalledWith(repo, base, head);
    expect(loaded.evalRevisions).toEqual({ base, head });
  });
  it('does not attribute fallback patches to git revisions', async () => {
    const git = { resolveRevision: vi.fn().mockRejectedValue(new Error()), diff: vi.fn().mockRejectedValue(new Error()) };
    const loaded = await loadDiff(git, { getPrFiles: async () => [] } as never, 'w', pull, repo);
    expect(loaded.evalRevisions).toBeUndefined();
  });
});

it('recovers the same diff after the base branch advances in a real Git repository', async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { SimpleGitClient } = await import('../src/adapters/git/simple-git.js');
  const root = await mkdtemp(join(tmpdir(), 'eval-revisions-'));
  const path = join(root, 'o', 'r');
  const git = (...args: string[]) => execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }).trim();
  try {
    await mkdir(path, { recursive: true });
    git('init', '-q'); git('checkout', '-qb', 'main');
    await writeFile(join(path, 'file'), 'old\n'); git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base');
    git('checkout', '-qb', 'feature'); await writeFile(join(path, 'file'), 'new\n'); git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'head');
    const headSha = git('rev-parse', 'HEAD');
    const client = new SimpleGitClient(root);
    const original = await loadDiff(client, {} as never, 'w', { id: 'p', base: 'main', headSha } as never, repo);
    expect(original.evalRevisions).toBeDefined();
    git('checkout', '-q', 'main'); await writeFile(join(path, 'other'), 'changed\n'); git('add', '.'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'advance base');
    const recovered = await client.diff(repo, original.evalRevisions!.base, original.evalRevisions!.head);
    expect(recovered.raw).toEqual(original.raw);
    expect(git('rev-parse', 'main')).not.toBe(original.evalRevisions!.base);
  } finally { await rm(root, { recursive: true, force: true }); }
});
