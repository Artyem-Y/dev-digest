import { createHash } from 'node:crypto';
import { parseUnifiedDiff } from '../../../adapters/git/diff-parser.js';
import type { Anchor } from '../domain/score.js';

/** Select one source file only after proving the complete input is unchanged. */
export function originalFragment(raw: string, expectedHash: string, anchor: Anchor): string | null {
  if (createHash('sha256').update(raw).digest('hex') !== expectedHash) return null;
  const chunks = raw.split(/(?=^diff --git )/m).filter(Boolean);
  for (const chunk of chunks) {
    const file = parseUnifiedDiff(chunk).files.find((entry) => entry.path === anchor.file);
    if (file?.hunks.some((hunk) => hunk.newLines > 0 && hunk.newStart <= anchor.endLine && hunk.newStart + hunk.newLines - 1 >= anchor.startLine)) return chunk;
  }
  return null;
}
