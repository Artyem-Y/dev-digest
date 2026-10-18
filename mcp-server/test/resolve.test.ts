import { describe, expect, it, vi } from 'vitest';
import { resolvePull } from '../src/core/resolve-pull.js';
import { resolveRepository } from '../src/core/resolve-repository.js';

describe('DevDigest locator errors', () => {
  it('directs an unknown repository lookup to GitHub MCP or gh', async () => {
    await expect(resolveRepository({ listRepos: vi.fn().mockResolvedValue([]) } as never, 'acme/missing'))
      .rejects.toThrow('GitHub MCP or gh');
  });

  it('directs an ambiguous repository lookup to GitHub MCP or gh', async () => {
    await expect(resolveRepository({ listRepos: vi.fn().mockResolvedValue([
      { id: '1', owner: 'acme', name: 'api', full_name: 'acme/api' },
      { id: '2', owner: 'other', name: 'api', full_name: 'other/api' },
    ]) } as never, 'api')).rejects.toThrow('GitHub MCP or gh');
  });

  it('directs a missing PR lookup to GitHub MCP or gh', async () => {
    await expect(resolvePull({ listPulls: vi.fn().mockResolvedValue([]) } as never, {
      id: 'repo-1', owner: 'acme', name: 'api', full_name: 'acme/api',
    }, 3)).rejects.toThrow('GitHub MCP or gh');
  });
});
