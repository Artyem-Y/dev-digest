import type { TrackedDocumentStore } from './ports.js';
import { estimateProjectDocumentTokens } from '../domain/token-estimator.js';
import { mapWithConcurrency } from './bounded-read.js';

/** Resolve attachment status in display order without unbounded Git processes. */
export async function listAttachments(paths: readonly string[], store: TrackedDocumentStore) {
  const catalog = new Set(await store.catalog());
  return mapWithConcurrency(paths, 4, async (path) => {
    if (!catalog.has(path)) return { path, status: 'no_longer_eligible' as const, estimated_tokens: 0 };
    const read = await store.read(path);
    return 'reason' in read
      ? { path, status: read.reason, estimated_tokens: 0 }
      : { path, status: 'attached' as const, estimated_tokens: estimateProjectDocumentTokens(read.content) };
  });
}
