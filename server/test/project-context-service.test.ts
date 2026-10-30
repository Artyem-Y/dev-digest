import { describe, expect, it, vi } from 'vitest';
import { ContextService } from '../src/modules/project-context/application/context-service.js';

describe('ContextService', () => {
  it('rescans local documents and reads requested paths', async () => {
    const store = { catalog: vi.fn().mockResolvedValue(['docs/a.md']), read: vi.fn(async (path: string) => ({ path, content: '# A' })) };
    const service = new ContextService(store);
    const scanned = await service.reindex();
    expect(scanned.source).toBe('local_main');
    expect(scanned.documents).toMatchObject([{ path: 'docs/a.md', availability: 'available' }]);
    expect(Number.isNaN(Date.parse(scanned.scanned_at))).toBe(false);
    await expect(service.readDocsByPaths(['docs/a.md'])).resolves.toEqual([{ path: 'docs/a.md', content: '# A' }]);
  });
});
