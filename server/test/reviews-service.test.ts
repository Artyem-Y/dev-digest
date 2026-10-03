import { describe, expect, it, vi } from 'vitest';
import { ReviewService } from '../src/modules/reviews/service.js';

const agent = { id: 'agent-1', name: 'Security Reviewer' };

describe('ReviewService', () => {
  it('resolves all enabled agents through its injected agent port', async () => {
    const agents = {
      listEnabled: vi.fn().mockResolvedValue([agent]),
      getById: vi.fn(),
    };
    const service = new ReviewService({ agents } as never);

    await expect(service.resolveTargets('workspace-1', { all: true })).resolves.toEqual([agent]);
    expect(agents.listEnabled).toHaveBeenCalledWith('workspace-1');
  });
});
