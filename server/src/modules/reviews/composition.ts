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
import { GetSmartDiff } from './smart-diff/application/get-smart-diff.js';
import { closingIssueNumber } from '../intents/application/closing-reference.js';

/** Wires review application services and external adapters at the outer boundary. */
export function createReviewService(container: Container): ReviewService {
  const repository = new ReviewRepository(container.db);
  const intentService = new DeriveIntentService({
    documents: new SafePublicDocumentFetcher(),
    linkedIssues: {
      async findLinkedIssue(repo, body) {
        const issueNumber = closingIssueNumber(body);
        if (issueNumber === undefined) return undefined;
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
    intentDeriver: {
      derive: (input) => intentService.derive(input),
    },
  });
}

/** Wires Smart Diff's read-only use case to the review persistence adapter. */
export function createSmartDiffService(container: Container): GetSmartDiff {
  const repository = new ReviewRepository(container.db);
  return new GetSmartDiff({
    getPull: (workspaceId, prId) => repository.getPull(workspaceId, prId),
    getPrFiles: async (prId) => (await repository.getPrFiles(prId)).map((file) => ({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
    })),
    currentReviewsForPull: async (prId) => (await repository.currentReviewsForPull(prId)).map(({ review, findings }) => ({
      review: {
        id: review.id,
        agentId: review.agentId,
        kind: review.kind,
        createdAt: review.createdAt,
      },
      findings: findings.map((finding) => ({ file: finding.file, startLine: finding.startLine })),
    })),
  });
}
