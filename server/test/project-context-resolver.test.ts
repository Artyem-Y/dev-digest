import { describe, expect, it, vi } from 'vitest';
import { resolveBriefContext } from '../src/modules/project-context/application/resolve-brief-context.js';
import type { ProjectContextRepository, TrackedDocumentStore } from '../src/modules/project-context/application/ports.js';

describe('resolveBriefContext', () => {
  it('resolves enabled direct and linked-skill attachments in stable deduplicated order, reading each path once', async () => {
    const repository: ProjectContextRepository = {
      listForBrief: vi.fn().mockResolvedValue([
        { path: 'z.md', provenance: 'direct_agent' },
        { path: 'a.md', provenance: 'linked_skill', skillId: 'skill-1' },
        { path: 'z.md', provenance: 'linked_skill', skillId: 'skill-2' },
      ]),
    };
    const store: TrackedDocumentStore = {
      catalog: vi.fn().mockResolvedValue(['a.md', 'z.md']),
      read: vi.fn(async (path) => ({ path, content: `# ${path}` })),
    };

    const result = await resolveBriefContext({ workspaceId: 'workspace', repoId: 'repo', repository, store });

    expect(result.documents.map((document) => document.path)).toEqual(['a.md', 'z.md']);
    expect(result.documents[1]?.provenance).toEqual(['direct_agent', 'linked_skill']);
    expect(store.read).toHaveBeenCalledTimes(2);
  });

  it('preserves fail-soft skip reasons for missing, unreadable, and no-longer-eligible attachments', async () => {
    const repository: ProjectContextRepository = {
      listForBrief: vi.fn().mockResolvedValue([
        { path: 'missing.md', provenance: 'direct_agent' },
        { path: 'bad.md', provenance: 'linked_skill', skillId: 'skill-1' },
        { path: 'gone.md', provenance: 'direct_agent' },
      ]),
    };
    const store: TrackedDocumentStore = {
      catalog: vi.fn().mockResolvedValue(['missing.md', 'bad.md']),
      read: vi.fn(async (path) => path === 'missing.md' ? { path, reason: 'missing' } : { path, reason: 'unreadable' }),
    };

    const result = await resolveBriefContext({ workspaceId: 'workspace', repoId: 'repo', repository, store });
    expect(result.documents).toEqual([]);
    expect(result.skipped).toEqual([
      { path: 'bad.md', reason: 'unreadable', provenance: ['linked_skill'] },
      { path: 'gone.md', reason: 'no_longer_eligible', provenance: ['direct_agent'] },
      { path: 'missing.md', reason: 'missing', provenance: ['direct_agent'] },
    ]);
  });

  it('normalizes before grouping so legacy separator duplicates are read once with united provenance', async () => {
    const repository: ProjectContextRepository = {
      listForBrief: vi.fn().mockResolvedValue([
        { path: 'docs//brief.md', provenance: 'direct_agent' },
        { path: 'docs/brief.md', provenance: 'linked_skill', skillId: 'skill-1' },
      ]),
    };
    const store: TrackedDocumentStore = {
      catalog: vi.fn().mockResolvedValue(['docs/brief.md']),
      read: vi.fn(async (path) => ({ path, content: 'brief' })),
    };
    const result = await resolveBriefContext({ workspaceId: 'workspace', repoId: 'repo', repository, store });
    expect(result.documents).toMatchObject([{ path: 'docs/brief.md', provenance: ['direct_agent', 'linked_skill'] }]);
    expect(store.read).toHaveBeenCalledTimes(1);
  });

  it('records corrupt persisted paths without reflecting unsafe path text', async () => {
    const repository: ProjectContextRepository = {
      listForBrief: vi.fn().mockResolvedValue([
        { path: '../outside.md', provenance: 'direct_agent' },
        { path: 'C:\\outside.md', provenance: 'linked_skill', skillId: 'skill-1' },
        { path: '/absolute.md', provenance: 'direct_agent' },
        { path: 'nul\0.md', provenance: 'linked_skill', skillId: 'skill-2' },
        { path: 'safe.md', provenance: 'direct_agent' },
      ]),
    };
    const store: TrackedDocumentStore = {
      catalog: vi.fn().mockResolvedValue(['safe.md']),
      read: vi.fn(async (path) => ({ path, content: 'safe' })),
    };
    const result = await resolveBriefContext({ workspaceId: 'workspace', repoId: 'repo', repository, store });
    expect(result.documents.map((document) => document.path)).toEqual(['safe.md']);
    expect(result.skipped).toHaveLength(4);
    expect(result.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringMatching(/^\[invalid project-context path #[1-4]\]$/), reason: 'no_longer_eligible' }),
    ]));
    expect(new Set(result.skipped.map((skipped) => skipped.path)).size).toBe(4);
    expect(JSON.stringify(result)).not.toContain('outside');
  });
});
