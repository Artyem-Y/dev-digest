import { expect, it, vi } from 'vitest';
import { OnboardingModelOutputSchema } from '@devdigest/reviewer-core';
import { createE2EOnboardingFixture } from '../src/adapters/llm/e2e-onboarding-fixture.js';
import { MockLLMProvider } from '../src/adapters/mocks.js';

it('returns deterministic usage once and fails the next onboarding attempt', async () => {
  vi.useFakeTimers();
  try {
    const provider = createE2EOnboardingFixture(new MockLLMProvider('openai'));
    const facts = [{ id: 'p', kind: 'path', value: 'src/main.ts' }, { id: 'c', kind: 'command', value: 'npm run test' }, { id: 'd', kind: 'dependency', value: 'src/main.ts -> src/lib.ts' }];
    const req = { model: 'fixture', schema: OnboardingModelOutputSchema, schemaName: 'OnboardingTour', messages: [{ role: 'user' as const, content: `<untrusted source="onboarding-facts">\n${JSON.stringify(facts)}\n</untrusted>` }] };
    const first = provider.completeStructured(req); await vi.advanceTimersByTimeAsync(3000);
    expect((await first).reportedUsage).toEqual({ inputTokens: 100, outputTokens: 20, costUsd: 0.001 });
    const second = provider.completeStructured(req); const assertion = expect(second).rejects.toThrow('fixture failure'); await vi.advanceTimersByTimeAsync(3000); await assertion;
  } finally { vi.useRealTimers(); }
});
