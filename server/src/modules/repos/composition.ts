import type { Container } from '../../platform/container.js';
import { RepoRepository } from './repository.js';
import { RepoService } from './service.js';

export function createRepoService(container: Container): RepoService {
  return new RepoService({
    repository: new RepoRepository(container.db),
    jobs: container.jobs,
    secrets: container.secrets,
    git: container.git,
  });
}
