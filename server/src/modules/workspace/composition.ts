import type { Container } from '../../platform/container.js';
import { WorkspaceRepository } from './repository.js';
import { WorkspaceService } from './service.js';

export function createWorkspaceService(container: Container): WorkspaceService {
  return new WorkspaceService(new WorkspaceRepository(container.db), container.config.cloneDir);
}
