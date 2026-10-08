import type { Container } from '../../platform/container.js';
import { PullsRepository } from './repository.js';
import { PullsService, type PullsWarningLogger } from './service.js';

export function createPullsService(container: Container, warn: PullsWarningLogger): PullsService {
  return new PullsService(new PullsRepository(container.db), () => container.github(), Date.now, warn);
}
