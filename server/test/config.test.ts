import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/platform/config.js';

describe('loadConfig — prompt builder logging', () => {
  it('enables detailed prompt metadata only for an explicit development flag', () => {
    expect(loadConfig({ NODE_ENV: 'development', PROMPT_BUILDER_DEBUG: 'true' }).promptBuilderDebug).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production', PROMPT_BUILDER_DEBUG: 'true' }).promptBuilderDebug).toBe(false);
    expect(loadConfig({ NODE_ENV: 'development' }).promptBuilderDebug).toBe(false);
  });
});

describe('loadConfig — Project Context roots', () => {
  it('uses defaults and accepts explicitly configured repository-relative roots', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).projectContextRoots).toEqual(['specs', 'docs', 'insights']);
    expect(loadConfig({ NODE_ENV: 'test', PROJECT_CONTEXT_ROOTS: 'handbook, packages/guides' }).projectContextRoots).toEqual(['handbook', 'packages/guides']);
  });

  it('rejects unsafe or empty root configuration', () => {
    for (const roots of ['', '../private', '/absolute', 'docs,,specs', 'docs\\outside']) {
      expect(() => loadConfig({ NODE_ENV: 'test', PROJECT_CONTEXT_ROOTS: roots })).toThrow();
    }
  });
});
