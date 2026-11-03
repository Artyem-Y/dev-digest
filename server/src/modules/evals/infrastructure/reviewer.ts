import type { LLMProvider, Provider } from '@devdigest/shared';
import { reviewPullRequest } from '@devdigest/reviewer-core';
import { parseUnifiedDiff } from '../../../adapters/git/diff-parser.js';
import type { EvalExecutionPort } from '../application/run-suite.js';
import { resolveFixture } from './prepared-fixtures.js';

export function createEvalReviewer(resolve: (provider: Provider) => Promise<LLMProvider>): EvalExecutionPort {
  return {
    async review({ agent, evalCase, signal }) {
      const fixture = resolveFixture(evalCase.fixtureId, evalCase.fixtureHash);
      if (!fixture && !evalCase.diff) throw new Error('Eval input is missing');
      const provider = await resolve(agent.provider as Provider);
      // Ensure the reviewer cannot introduce structured-output retries; the
      // adapter's timeout remains a second bound at the provider boundary.
      const llm: LLMProvider = {
        id: provider.id,
        listModels: () => provider.listModels(),
        complete: (request) => provider.complete({ ...request, timeoutMs: 120_000 }),
        completeStructured: (request) => provider.completeStructured({ ...request, timeoutMs: 120_000, maxRetries: 0, nativeTimeout: true }),
        embed: (texts) => provider.embed(texts),
      };
      const outcome = await reviewPullRequest({
        systemPrompt: agent.systemPrompt, model: agent.model, diff: parseUnifiedDiff(evalCase.diff ?? fixture!.diff),
        llm, strategy: agent.strategy, skills: agent.skills, maxRetries: 0,
        prDescription: fixture?.metadata.description ?? undefined,
        task: `Review ${fixture?.metadata.title ?? 'original PR diff'}`,
        checkCancelled: () => { if (signal.aborted) throw new Error('cancelled'); },
      });
      return {
        grounded: outcome.review.findings.map((finding) => ({ file: finding.file, startLine: finding.start_line, endLine: finding.end_line })),
        dropped: outcome.dropped.length, costUsd: outcome.costUsd,
      };
    },
  };
}
