import type { Container } from '../../platform/container.js';
import { loadDiff } from './diff-loader.js';
import { ReviewRepository } from './repository.js';
import { ReviewRunExecutor } from './run-executor.js';
import { ReviewService } from './service.js';
import { AgentsRepository } from '../agents/repository.js';
import { isUnsafeSkillContent } from '../../vendor/shared/skill-safety.js';

/** Wires review application services and external adapters at the outer boundary. */
export function createReviewService(container: Container): ReviewService {
  const repository = new ReviewRepository(container.db);
  const executor = new ReviewRunExecutor({
    runBus: container.runBus,
    resolveLlm: (provider) => container.llm(provider),
    repoIntel: container.repoIntel,
    loadDiff: (workspaceId, pull, repo) => loadDiff(container.git, repository, workspaceId, pull, repo),
    resolveSkills: async (agentId) => {
      const links = await new AgentsRepository(container.db).linkedSkills(agentId);
      return links
        .filter(({ skill, enabled }) => skill.enabled && enabled && !isUnsafeSkillContent(skill.body))
        .map(({ skill }) => ({ name: skill.name, body: skill.body }));
    },
  }, repository);
  return new ReviewService({
    repository,
    agents: container.agentsRepo,
    executor,
    runBus: container.runBus,
  });
}
