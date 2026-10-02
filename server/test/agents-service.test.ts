import { describe, expect, it, vi } from 'vitest';
import { AgentsService } from '../src/modules/agents/service.js';

describe('AgentsService', () => {
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
