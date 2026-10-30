import { catalogProjectDocuments } from './catalog-project-documents.js';
import { mapWithConcurrency } from './bounded-read.js';
import type { TrackedDocumentStore } from './ports.js';

/** Each service instance reads a fresh immutable snapshot of local main. */
export class ContextService {
  constructor(private readonly store: TrackedDocumentStore) {}

  listDocs() { return catalogProjectDocuments(this.store); }

  async reindex() {
    const documents = await this.listDocs();
    return { documents, scanned_at: new Date().toISOString(), source: 'local_main' as const };
  }

  readDocsByPaths(paths: readonly string[]) {
    return mapWithConcurrency(paths, 4, (path) => this.store.read(path));
  }
}
