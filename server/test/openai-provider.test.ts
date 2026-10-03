import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OpenAIProvider } from '../src/adapters/llm/openai.js';

const Result = z.object({ ok: z.boolean() });

describe('OpenAIProvider structured requests', () => {
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
