import { describe, expect, it, vi } from 'vitest';
import { AgentsService } from '../src/modules/agents/service.js';

describe('AgentsService', () => {
  it('projects agents for MCP without prompt-bearing fields', async () => {
    const listMcpSummaries = vi.fn().mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Security Reviewer',
        description: 'Finds security issues.',
        provider: 'openai',
        model: 'gpt-4.1-mini',
        enabled: true,
        version: 2,
      },
    ]);
    const service = new AgentsService({
      repository: { listMcpSummaries } as never,
      listModels: vi.fn(),
    });

    await expect(service.listMcpSummaries('workspace-1')).resolves.toEqual([
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Security Reviewer',
        description: 'Finds security issues.',
        enabled: true,
        provider: 'openai',
        model: 'gpt-4.1-mini',
        version: 2,
      },
    ]);
    expect(listMcpSummaries).toHaveBeenCalledWith('workspace-1');
  });

  it('lists provider models through its narrow application dependency', async () => {
    const listModels = vi.fn().mockResolvedValue([{ id: 'gpt-test', name: 'Test model' }]);
    const service = new AgentsService({
      repository: {} as never,
      listModels,
    });

    await expect(service.listModels('openai')).resolves.toEqual([{ id: 'gpt-test', name: 'Test model' }]);
    expect(listModels).toHaveBeenCalledWith('openai');
  });
});
