import type { Container } from '../../platform/container.js';
import { loadDiff } from './diff-loader.js';
import { ReviewRepository } from './repository.js';
import { ReviewRunExecutor } from './run-executor.js';
import { ReviewService } from './service.js';

/** Wires review application services and external adapters at the outer boundary. */
export function createReviewService(container: Container): ReviewService {
  const repository = new ReviewRepository(container.db);
  const executor = new ReviewRunExecutor({
    runBus: container.runBus,
    resolveLlm: (provider) => container.llm(provider),
    repoIntel: container.repoIntel,
    loadDiff: (workspaceId, pull, repo) => loadDiff(container.git, repository, workspaceId, pull, repo),
  }, repository);
  return new ReviewService({
    repository,
    agents: container.agentsRepo,
    executor,
    runBus: container.runBus,
  });
}
