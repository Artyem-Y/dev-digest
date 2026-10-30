import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OpenAIProvider, REVIEW_COMPLETION_TIMEOUT_MS } from '../src/adapters/llm/openai.js';

const Result = z.object({ ok: z.boolean() });

describe('OpenAIProvider structured requests', () => {
  it('allows a long-running agent review up to three minutes', () => {
    expect(REVIEW_COMPLETION_TIMEOUT_MS).toBe(180_000);
  });

  it('omits temperature when the review does not explicitly set it', async () => {
    const provider = new OpenAIProvider('test-key');
    const calls: Record<string, unknown>[] = [];
    (provider as unknown as { client: unknown }).client = {
      chat: {
        completions: {
          create: async (request: Record<string, unknown>) => {
            calls.push(request);
            return {
              choices: [{ message: { content: '{"ok":true}' } }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            };
          },
        },
      },
    };

    await provider.completeStructured({
      model: 'gpt-4',
      schema: Result,
      schemaName: 'Result',
      messages: [{ role: 'user', content: 'Return JSON.' }],
    });

    expect(calls[0]).not.toHaveProperty('temperature');
  });
});

it('disables both SDK and transport retries and leaves absent usage unknown', async () => {
  const provider = new OpenAIProvider('test-key');
  let calls = 0;
  let options: unknown;
  (provider as unknown as { client: unknown }).client = { chat: { completions: { create: async (_request: unknown, opts: unknown) => {
    calls++; options = opts; return { choices: [{ message: { content: '{"ok":true}' } }] };
  } } } };
  const result = await provider.completeStructured({ model: 'gpt-4', schema: Result, schemaName: 'Result', messages: [], maxRetries: 0 });
  expect(calls).toBe(1);
  expect(options).toEqual({ maxRetries: 0 });
  expect(result.reportedUsage).toEqual({ inputTokens: null, outputTokens: null, costUsd: null });
  (provider as unknown as { client: unknown }).client = { chat: { completions: { create: async () => { calls++; throw Object.assign(new Error('busy'), { status: 503 }); } } } };
  await expect(provider.completeStructured({ model: 'gpt-4', schema: Result, schemaName: 'Result', messages: [], maxRetries: 0 })).rejects.toThrow();
  expect(calls).toBe(2);
});
