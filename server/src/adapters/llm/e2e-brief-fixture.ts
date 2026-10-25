import type { LLMProvider, ModelInfo, CompletionRequest, CompletionResult, StructuredRequest, StructuredResult } from '@devdigest/shared';
import { MockLLMProvider } from '../mocks.js';

/** The only environment combination that enables the hermetic browser fixture. */
export function shouldUseE2EBriefFixture(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'test' && env.DEVDIGEST_E2E_BRIEF_FIXTURE === '1';
}

const PR_BRIEF_FIXTURE = {
  summary: 'Public API rate limiting is wired through the new middleware.',
  risks: {
    risks: [{
      kind: 'configuration',
      title: 'Keep the public limiter configuration reviewable',
      explanation: 'The seeded PR changes public API behavior and configuration together.',
      severity: 'medium' as const,
      file_refs: ['src/config.ts'],
    }],
  },
  review_focus: [{
    file: 'src/config.ts',
    line: 12,
    reason: 'Verify the public rate-limit configuration at the changed line.',
  }],
};

/**
 * Test-only, deterministic provider for the hermetic browser journey.
 *
 * It deliberately accepts only the Brief structured-call shape. The production
 * container reaches this factory only through `shouldUseE2EBriefFixture`; no
 * fixture name, request parameter, or runtime UI control can select it.
 */
export function createE2EBriefFixture(): LLMProvider {
  const mock = new MockLLMProvider('openai', {
    structuredBySchema: { PrBrief: PR_BRIEF_FIXTURE },
  });

  return {
    id: mock.id,
    listModels: (): Promise<ModelInfo[]> => mock.listModels(),
    complete: (_req: CompletionRequest): Promise<CompletionResult> =>
      Promise.reject(new Error('E2E Brief fixture only supports structured Brief generation')),
    completeStructured: async <T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> => {
      if (req.schemaName !== 'PrBrief') {
        throw new Error('E2E Brief fixture only supports PrBrief');
      }
      return mock.completeStructured(req);
    },
    embed: async (_texts: string[]): Promise<number[][]> => {
      throw new Error('E2E Brief fixture does not support embeddings');
    },
  };
}
