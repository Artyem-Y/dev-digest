import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BriefModelOutputSchema } from '@devdigest/reviewer-core';
import { createE2EBriefFixture, shouldUseE2EBriefFixture } from '../src/adapters/llm/e2e-brief-fixture.js';

describe('hermetic PR Brief fixture', () => {
  it('is enabled only by the two exact hermetic-test environment flags', () => {
    expect(shouldUseE2EBriefFixture({ NODE_ENV: 'test', DEVDIGEST_E2E_BRIEF_FIXTURE: '1' })).toBe(true);
    expect(shouldUseE2EBriefFixture({ NODE_ENV: 'development', DEVDIGEST_E2E_BRIEF_FIXTURE: '1' })).toBe(false);
    expect(shouldUseE2EBriefFixture({ NODE_ENV: 'test', DEVDIGEST_E2E_BRIEF_FIXTURE: 'true' })).toBe(false);
    expect(shouldUseE2EBriefFixture({ NODE_ENV: 'test' })).toBe(false);
  });

  it('returns the stable grounded Brief fixture and rejects other schemas', async () => {
    const provider = createE2EBriefFixture();
    const result = await provider.completeStructured({
      model: 'fixture-model',
      schemaName: 'PrBrief',
      schema: BriefModelOutputSchema,
      messages: [],
    });

    expect(result.data).toMatchObject({
      summary: 'Public API rate limiting is wired through the new middleware.',
      risks: { risks: [{ file_refs: ['src/config.ts'] }] },
      review_focus: [{ file: 'src/config.ts', line: 12 }],
    });
    await expect(provider.completeStructured({
      model: 'fixture-model',
      schemaName: 'NotPrBrief',
      schema: z.object({}),
      messages: [],
    })).rejects.toThrow('only supports PrBrief');
  });
});
