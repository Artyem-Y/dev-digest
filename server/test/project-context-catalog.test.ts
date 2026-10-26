import { describe, expect, it, vi } from 'vitest';
import { catalogProjectDocuments } from '../src/modules/project-context/application/catalog-project-documents.js';
import type { TrackedDocumentStore } from '../src/modules/project-context/application/ports.js';

describe('catalogProjectDocuments', () => {
  it('bounds concurrent document reads while preserving catalog order', async () => {
    let active = 0;
    let peak = 0;
    const paths = Array.from({ length: 8 }, (_, index) => `docs/${index}.md`);
    const store: TrackedDocumentStore = {
      catalog: vi.fn().mockResolvedValue(paths),
      read: vi.fn(async (path) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 0));
        active -= 1;
        return { path, content: path };
      }),
    };

    const result = await catalogProjectDocuments(store);

    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
    expect(result.map((document) => document.path)).toEqual(paths);
  });
});
