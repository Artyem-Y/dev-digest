import { describe, expect, it, vi } from 'vitest';
import { listAttachments } from '../src/modules/project-context/application/list-attachments.js';
import type { TrackedDocumentStore } from '../src/modules/project-context/application/ports.js';

describe('Project Context attachment listing', () => {
  it('bounds concurrent reads while preserving order and unavailable states', async () => {
    const paths = Array.from({ length: 24 }, (_, i) => `docs/${i}.md`);
    let active = 0;
    let peak = 0;
    const store: TrackedDocumentStore = {
      catalog: vi.fn().mockResolvedValue(paths.slice(0, -1)),
      read: vi.fn(async (path) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return path === paths[1] ? { path, reason: 'unreadable' as const } : { path, content: '# Document' };
      }),
    };
    const result = await listAttachments(paths, store);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
    expect(result.map((item) => item.path)).toEqual(paths);
    expect(result[1]).toMatchObject({ status: 'unreadable', estimated_tokens: 0 });
    expect(result.at(-1)).toMatchObject({ status: 'no_longer_eligible', estimated_tokens: 0 });
    expect(store.read).toHaveBeenCalledTimes(23);
  });
});
