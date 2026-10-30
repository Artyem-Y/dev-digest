import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AnthropicProvider } from '../src/adapters/llm/anthropic.js';

it('sends one structured request with SDK retries disabled', async () => {
  const provider = new AnthropicProvider('test-key');
  const create = vi.fn(async (_request: unknown, _options: unknown) => ({ usage: { input_tokens: 0, output_tokens: 1 }, content: [{ type: 'tool_use', input: { ok: true } }] }));
  (provider as unknown as { client: unknown }).client = { messages: { create } };
  const result = await provider.completeStructured({ model: 'test', schema: z.object({ ok: z.boolean() }), schemaName: 'Result', messages: [], maxRetries: 0 });
  expect(create).toHaveBeenCalledTimes(1);
  expect(create.mock.calls[0]?.[1]).toEqual({ maxRetries: 0 });
  expect(result.reportedUsage).toEqual({ inputTokens: 0, outputTokens: 1, costUsd: null });
});
