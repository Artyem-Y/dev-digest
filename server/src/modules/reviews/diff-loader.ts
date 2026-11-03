import type { GitClient, UnifiedDiff } from '@devdigest/shared';
import { parseUnifiedDiff } from '../../adapters/git/diff-parser.js';
import type { ReviewRepository, PullRow } from './repository.js';

export type ReviewDiff = UnifiedDiff & { evalRevisions?: { base: string; head: string } };

export interface ReviewRepositoryRef { owner: string; name: string; }

/**
 * Load the unified diff for a PR. Prefers a real `git diff base...head`; falls
 * back to assembling a synthetic unified diff from the persisted pr_files
 * patches (so the reviewer works even before a clone completes / in tests).
 */
export async function loadDiff(
  git: Pick<GitClient, 'diff' | 'resolveRevision'>,
  repo: ReviewRepository,
  workspaceId: string,
  pull: PullRow,
  repoRow: ReviewRepositoryRef,
): Promise<ReviewDiff> {
  try {
    const base = await git.resolveRevision(repoRow, pull.base);
    const head = await git.resolveRevision(repoRow, pull.headSha);
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(base) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(head)) throw new Error('Unresolved revision');
    const diff = await git.diff(repoRow, base, head);
    if (diff.files.length > 0) return { ...diff, evalRevisions: { base, head } };
  } catch { /* preserve legacy diff fallback */ }
  try {
    const diff = await git.diff(
      { owner: repoRow.owner, name: repoRow.name },
      pull.base,
      pull.headSha,
    );
    if (diff.files.length > 0) return diff;
  } catch {
    /* fall through to pr_files reconstruction */
  }
  return diffFromPrFiles(repo, pull.id);
}

/** Reconstruct a UnifiedDiff from persisted pr_files patches. */
export async function diffFromPrFiles(repo: ReviewRepository, prId: string): Promise<UnifiedDiff> {
  const files = await repo.getPrFiles(prId);
  const parts: string[] = [];
  for (const f of files) {
    if (!f.patch) continue;
    parts.push(`diff --git a/${f.path} b/${f.path}`);
    parts.push(`--- a/${f.path}`);
    parts.push(`+++ b/${f.path}`);
    parts.push(f.patch);
  }
  return parseUnifiedDiff(parts.join('\n'));
}
