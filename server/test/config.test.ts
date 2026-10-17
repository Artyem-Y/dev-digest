import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/platform/config.js';

describe('loadConfig — prompt builder logging', () => {
  it('enables detailed prompt metadata only for an explicit development flag', () => {
    expect(loadConfig({ NODE_ENV: 'development', PROMPT_BUILDER_DEBUG: 'true' }).promptBuilderDebug).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production', PROMPT_BUILDER_DEBUG: 'true' }).promptBuilderDebug).toBe(false);
    expect(loadConfig({ NODE_ENV: 'development' }).promptBuilderDebug).toBe(false);
  });
});
