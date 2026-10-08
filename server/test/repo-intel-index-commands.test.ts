import { describe, expect, it, vi } from 'vitest';
import { RepoIntelIndexCommands } from '../src/modules/repo-intel/index-commands.js';

describe('RepoIntelIndexCommands', () => {
  it('does not sync or index a repository without a clone', async () => {
    const repository = { getRepoBasics: vi.fn().mockResolvedValue({ owner: 'acme', name: 'api', defaultBranch: 'main', clonePath: null }) };
    const git = { sync: vi.fn() };
    const indexer = { full: vi.fn(), incremental: vi.fn() };
    const commands = new RepoIntelIndexCommands(repository, git, indexer, () => 100);

    await expect(commands.resync('repo-1')).resolves.toMatchObject({ status: 'degraded', reason: 'no_clone' });
    expect(git.sync).not.toHaveBeenCalled();
    expect(indexer.incremental).not.toHaveBeenCalled();
  });
});
