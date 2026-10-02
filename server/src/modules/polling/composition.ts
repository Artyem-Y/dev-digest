import type { Container } from '../../platform/container.js';
import { PollingRepository } from './repository.js';
import { PollingService } from './service.js';

export function createPollingService(container: Container): PollingService {
  return new PollingService(new PollingRepository(container.db), () => container.github());
}
