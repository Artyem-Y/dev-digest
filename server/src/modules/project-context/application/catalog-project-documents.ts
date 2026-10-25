import { estimateProjectDocumentTokens } from '../domain/token-estimator.js';
import type { TrackedDocumentStore } from './ports.js';

export async function catalogProjectDocuments(store: TrackedDocumentStore) {
  const paths = await store.catalog();
  return Promise.all(paths.map(async (path) => {
    const read = await store.read(path);
    return 'content' in read
      ? { path, availability: 'available' as const, estimated_tokens: estimateProjectDocumentTokens(read.content) }
      : { path, availability: read.reason, estimated_tokens: 0 };
  }));
}
