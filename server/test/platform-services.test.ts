import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../src/platform/errors.js';
import { SettingsService } from '../src/modules/settings/service.js';
import { WorkspaceService } from '../src/modules/workspace/service.js';
import { PollingService } from '../src/modules/polling/service.js';

describe('platform application services', () => {
  it('reports only configured-provider booleans', async () => {
    const service = new SettingsService(
      { list: async () => [], upsert: async () => {} },
      {
        get: async (key) => (key === 'OPENAI_API_KEY' ? 'private-value' : undefined),
      },
      async () => { throw new Error('not used'); },
      async () => { throw new Error('not used'); },
      () => {},
    );

    await expect(service.secretsStatus()).resolves.toEqual({
      openai: true,
      anthropic: false,
      openrouter: false,
      github: false,
    });
  });

  it('maps only repositories returned by the workspace-scoped port', async () => {
    const service = new WorkspaceService(
      {
        list: async (workspaceId) => workspaceId === 'workspace-a' ? [{
          id: 'repo-a', fullName: 'acme/a', clonePath: '/clones/a', lastPolledAt: null,
        }] : [],
      },
      '/clones',
    );

    await expect(service.summary('workspace-a')).resolves.toEqual({
      workspaceId: 'workspace-a',
      cloneDir: '/clones',
      repos: [{ id: 'repo-a', full_name: 'acme/a', clone_path: '/clones/a', last_polled_at: null, cloned: true }],
    });
  });

  it('does not poll a repository absent from the caller workspace', async () => {
    const service = new PollingService(
      { findRepo: async () => undefined, upsertPull: async () => {}, markPolled: async () => {} },
      async () => { throw new Error('GitHub must not be resolved'); },
    );

    await expect(service.poll('workspace-a', 'repo-b')).rejects.toBeInstanceOf(NotFoundError);
  });
});
