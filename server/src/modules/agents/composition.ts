import type { Container } from '../../platform/container.js';
import { AgentsRepository } from './repository.js';
import { AgentsService } from './service.js';

/** Wires the agents application's narrow dependencies at the outer boundary. */
export function createAgentsService(container: Container): AgentsService {
  return new AgentsService({
    repository: new AgentsRepository(container.db),
    listModels: async (provider) => (await container.llm(provider)).listModels(),
  });
}
