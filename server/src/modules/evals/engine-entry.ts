// Bundled together with the reviewer, scorer, provider adapters and SDKs.
// Only secrets and network I/O cross the artifact boundary.
export { runSuite } from './application/run-suite.js';
export { createEvalReviewer } from './infrastructure/reviewer.js';
export { OpenAIProvider } from '../../adapters/llm/openai.js';
export { AnthropicProvider } from '../../adapters/llm/anthropic.js';
export { OpenRouterProvider } from '@devdigest/reviewer-core';
import { OpenAIProvider } from '../../adapters/llm/openai.js';
import { AnthropicProvider } from '../../adapters/llm/anthropic.js';
import { OpenRouterProvider } from '@devdigest/reviewer-core';
import type { Provider } from '@devdigest/shared';

export function secretKeyName(id: Provider): string {
  return id === 'openai' ? 'OPENAI_API_KEY' : id === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENROUTER_API_KEY';
}

export function createProvider(id: Provider, key: string) {
  return id === 'openai' ? new OpenAIProvider(key) : id === 'anthropic' ? new AnthropicProvider(key) : new OpenRouterProvider(key);
}
