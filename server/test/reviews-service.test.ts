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

  it('resolves each selected agent once for a multi-agent review', async () => {
    const agents = {
      listEnabled: vi.fn(),
      getById: vi.fn()
        .mockResolvedValueOnce({ id: 'agent-1', name: 'Security Reviewer' })
        .mockResolvedValueOnce({ id: 'agent-2', name: 'Performance Reviewer' }),
    };
    const service = new ReviewService({ agents } as never);

    await expect(service.resolveTargets('workspace-1', { agentIds: ['agent-1', 'agent-2', 'agent-1'] })).resolves.toEqual([
      { id: 'agent-1', name: 'Security Reviewer' },
      { id: 'agent-2', name: 'Performance Reviewer' },
    ]);
    expect(agents.getById).toHaveBeenCalledTimes(2);
  });
});
