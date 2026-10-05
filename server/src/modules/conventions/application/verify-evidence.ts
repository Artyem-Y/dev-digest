import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export type VerifiedConventionEvidence = {
  evidencePath: string;
  evidenceLine: number;
  evidenceSnippet: string;
};

const MAX_SOURCE_BYTES = 256_000;

/**
 * Turns a model's file-and-line claim into trusted evidence. A candidate may
 * reference only a regular file selected for this scan and may never escape the
 * repository clone through traversal or a symlink.
 */
export async function verifyConventionEvidence(
  cloneRoot: string,
  sampledPaths: ReadonlySet<string>,
  evidencePath: string,
  evidenceLine: number,
): Promise<VerifiedConventionEvidence | null> {
  if (!Number.isInteger(evidenceLine) || evidenceLine < 1) return null;
  if (!evidencePath || isAbsolute(evidencePath) || evidencePath.includes('\\')) return null;

  const normalized = evidencePath.replace(/^\.\//, '');
  if (!sampledPaths.has(normalized)) return null;

  const root = await realpath(cloneRoot).catch(() => null);
  if (!root) return null;
  const candidate = resolve(root, normalized);
  const relation = relative(root, candidate);
  if (!relation || relation.startsWith('..') || isAbsolute(relation)) return null;

  const stat = await lstat(candidate).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > MAX_SOURCE_BYTES) return null;

  const target = await realpath(candidate).catch(() => null);
  if (!target || !target.startsWith(root + sep)) return null;

  const source = await readFile(target, 'utf8').catch(() => null);
  if (source === null) return null;
  const line = source.split(/\r?\n/)[evidenceLine - 1]?.trim();
  if (!line) return null;

  return { evidencePath: normalized, evidenceLine, evidenceSnippet: line };
}

