import type { Container } from '../../platform/container.js';
import { RepoIntelIndexCommands } from './index-commands.js';
import { RepoIntelIndexer } from './indexer.js';
import { RepoIntelRepository } from './repository.js';
import { RepoIntelService } from './service.js';

/** Composition boundary for the repo-intel facade and its infrastructure adapters. */
export function createRepoIntelService(container: Container): RepoIntelService {
  const repository = new RepoIntelRepository(container.db);
  const indexer = new RepoIntelIndexer(container, repository);
  const indexCommands = new RepoIntelIndexCommands(repository, container.git, indexer);
  return new RepoIntelService({
    repository,
    enabled: container.config.repoIntelEnabled,
    codeIndex: container.codeIndex,
    jobs: container.jobs,
    indexCommands,
  });
}
