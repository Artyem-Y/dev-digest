import type { Container } from '../../platform/container.js';
import { CasesRepository } from './infrastructure/cases-repository.js';
import { SuiteRepository } from './infrastructure/suite-repository.js';
import { createEvalReviewer } from './infrastructure/reviewer.js';
import { runSuite } from './application/run-suite.js';
import { loadEvalEngine } from './infrastructure/engine-artifact.js';
import { ConfigError } from '../../platform/errors.js';
import type { LLMProvider, Provider } from '@devdigest/shared';
import { ReviewRepository } from '../reviews/repository.js';
import { loadDiff } from '../reviews/diff-loader.js';
import { SuiteAdmissionError } from './infrastructure/suite-repository.js';

export function createCasesRepository(container: Container): CasesRepository {
  const reviews = new ReviewRepository(container.db);
  return new CasesRepository(container.db, (workspaceId, pull, repo, revisions) => revisions ? container.git.diff(repo, revisions.base, revisions.head) : loadDiff(container.git, reviews, workspaceId, pull, repo));
}

export function createEvalSuiteService(container: Container) {
  const repository = new SuiteRepository(container.db);
  const reviewer = createEvalReviewer((provider) => container.llm(provider));
  const queue: Array<() => Promise<void>> = [];
  let running = 0;
  let reserved = 0;
  const pump = () => {
    while (running < 3 && queue.length) {
      const task = queue.shift()!;
      running++;
      void task().catch(() => { /* startup recovery handles unfinished runs */ }).finally(() => { running--; reserved--; pump(); });
    }
  };
  return {
    repository,
    async start(workspaceId: string, agentId: string, caseId?: string) {
      if (reserved >= 100) throw new SuiteAdmissionError('capacity');
      reserved++;
      try {
      const artifact = container.hasUnverifiedEvalProviders() ? null : await loadEvalEngine();
      const executionRepository = artifact ? new SuiteRepository(container.db, artifact.version) : repository;
      const providers = new Map<Provider, LLMProvider>();
      const artifactReviewer = artifact?.engine.createEvalReviewer(async (id) => {
        const cached = providers.get(id);
        if (cached) return cached;
        const keyName = artifact.engine.secretKeyName(id);
        const key = await container.secrets.get(keyName);
        if (!key) throw new ConfigError(`${keyName} is not configured`);
        const provider = artifact.engine.createProvider(id, key);
        providers.set(id, provider);
        return provider;
      });
      const admitted = await executionRepository.admit(workspaceId, agentId, caseId);
      queue.push(async () => {
        try {
          await executionRepository.markRunning(workspaceId, admitted.run.id);
          const result = artifact && artifactReviewer
            ? await artifact.engine.runSuite(artifactReviewer, admitted.agent, admitted.cases)
            : await runSuite(reviewer, admitted.agent, admitted.cases);
          await executionRepository.finish(workspaceId, admitted.run.id, result);
        } catch {
          await executionRepository.finish(workspaceId, admitted.run.id, { status: 'failed', results: [], score: null, costUsd: null });
        }
      });
      pump();
      return admitted.run;
      } catch (error) { reserved--; throw error; }
    },
  };
}
