import { describe, expect, it, vi } from 'vitest';
import { resolvePull } from '../src/core/resolve-pull.js';
import { resolvePullLocator } from '../src/core/resolve-pull-locator.js';
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

  it('resolves a repository by its DevDigest ID', async () => {
    await expect(resolveRepository({ listRepos: vi.fn().mockResolvedValue([
      { id: 'repo-1', owner: 'acme', name: 'api', full_name: 'acme/api' },
    ]) } as never, 'repo-1')).resolves.toMatchObject({ full_name: 'acme/api' });
  });

  it('directs a missing PR lookup to GitHub MCP or gh', async () => {
    await expect(resolvePull({ listPulls: vi.fn().mockResolvedValue([]) } as never, {
      id: 'repo-1', owner: 'acme', name: 'api', full_name: 'acme/api',
    }, 3)).rejects.toThrow('GitHub MCP or gh');
  });

  it('uses the server-side locator instead of downloading repository pull lists', async () => {
    const api = {
      lookupPulls: vi.fn().mockResolvedValue([{
        id: 'pull-51', number: 42, title: 'Late repository',
        repository: { id: 'repo-51', owner: 'acme', name: 'repo-51', full_name: 'acme/repo-51' },
      }]),
      listRepos: vi.fn(),
      listPulls: vi.fn(),
    };

    await expect(resolvePullLocator(api as never, '42')).resolves.toMatchObject({
      id: 'pull-51', repository: { id: 'repo-51' },
    });
    expect(api.lookupPulls).toHaveBeenCalledWith('42');
    expect(api.listRepos).not.toHaveBeenCalled();
    expect(api.listPulls).not.toHaveBeenCalled();
  });
});
