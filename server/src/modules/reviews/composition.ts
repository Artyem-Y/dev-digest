import type { Container } from '../../platform/container.js';
import { loadDiff } from './diff-loader.js';
import { ReviewRepository } from './repository.js';
import { ReviewRunExecutor } from './run-executor.js';
import { ReviewService } from './service.js';
import { AgentsRepository } from '../agents/repository.js';
import { isUnsafeSkillContent } from '../../vendor/shared/skill-safety.js';
import { DeriveIntentService } from '../intents/application/derive-intent.js';
import { SafePublicDocumentFetcher } from '../intents/infrastructure/public-document-fetcher.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { SettingsRepository } from '../settings/repository.js';

/** Wires review application services and external adapters at the outer boundary. */
export function createReviewService(container: Container): ReviewService {
  const repository = new ReviewRepository(container.db);
  const intentService = new DeriveIntentService({
    documents: new SafePublicDocumentFetcher(),
    linkedIssues: {
      async findLinkedIssue(repo, body) {
        const issueNumber = Number((body ?? '').match(/(?:closes|fixes|resolves)?\s*#(\d+)/i)?.[1]);
        if (!Number.isFinite(issueNumber)) return undefined;
        const issue = await container.github().then((github) => github.getIssue(repo, issueNumber));
        return { title: issue.title, body: issue.body ?? null };
      },
    },
    featureModels: { resolve: (workspaceId) => resolveFeatureModel(new SettingsRepository(container.db), workspaceId, 'review_intent') },
    llm: { resolve: (provider) => container.llm(provider) },
    intents: repository,
  });
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
    promptBuilderDebug: container.config.promptBuilderDebug,
    deriveIntent: ({ workspaceId, prId, title, body, repo }) => intentService.derive({ workspaceId, prId, title, body, repo }),
  }, repository);
  return new ReviewService({
    repository,
    agents: container.agentsRepo,
    executor,
    runBus: container.runBus,
  });
}
