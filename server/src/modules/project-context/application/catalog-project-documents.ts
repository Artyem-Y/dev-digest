import { estimateProjectDocumentTokens } from '../domain/token-estimator.js';
import type { TrackedDocumentStore } from './ports.js';
import { mapWithConcurrency } from './bounded-read.js';

const DOCUMENT_READ_CONCURRENCY = 4;

export async function catalogProjectDocuments(store: TrackedDocumentStore) {
  const paths = await store.catalog();
  return mapWithConcurrency(paths, DOCUMENT_READ_CONCURRENCY, async (path) => {
    const read = await store.read(path);
    return 'content' in read
      ? { path, availability: 'available' as const, estimated_tokens: estimateProjectDocumentTokens(read.content) }
      : { path, availability: read.reason, estimated_tokens: 0 };
  });
}
