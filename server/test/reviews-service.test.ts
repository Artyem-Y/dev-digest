import { describe, expect, it, vi } from 'vitest';
import { ReviewService } from '../src/modules/reviews/service.js';
import { NotFoundError } from '../src/platform/errors.js';

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

  it('resolves selected agents with one bulk lookup for a multi-agent review', async () => {
    const agents = {
      listEnabled: vi.fn(),
      getById: vi.fn(),
      getByIds: vi.fn().mockResolvedValue([
        { id: 'agent-1', name: 'Security Reviewer' },
        { id: 'agent-2', name: 'Performance Reviewer' },
      ]),
    };
    const service = new ReviewService({ agents } as never);

    await expect(service.resolveTargets('workspace-1', { agentIds: ['agent-1', 'agent-2', 'agent-1'] })).resolves.toEqual([
      { id: 'agent-1', name: 'Security Reviewer' },
      { id: 'agent-2', name: 'Performance Reviewer' },
    ]);
    expect(agents.getByIds).toHaveBeenCalledWith('workspace-1', ['agent-1', 'agent-2']);
    expect(agents.getById).not.toHaveBeenCalled();
  });

  it('rejects a multi-agent selection when the bulk lookup misses an id', async () => {
    const agents = {
      listEnabled: vi.fn(),
      getById: vi.fn(),
      getByIds: vi.fn().mockResolvedValue([{ id: 'agent-1', name: 'Security Reviewer' }]),
    };
    const service = new ReviewService({ agents } as never);

    await expect(service.resolveTargets('workspace-1', { agentIds: ['agent-1', 'agent-2'] })).rejects.toBeInstanceOf(NotFoundError);
  });
});
