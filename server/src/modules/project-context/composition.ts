import type { Container } from '../../platform/container.js';
import { GitTrackedDocumentStore } from './infrastructure/git-tracked-document-store.js';
import { DrizzleProjectContextRepository } from './infrastructure/project-context.repository.js';

export function createProjectContextRepository(container: Container) {
  return new DrizzleProjectContextRepository(container.db);
}

export function createTrackedDocumentStore(checkoutPath: string) {
  return new GitTrackedDocumentStore(checkoutPath);
}
