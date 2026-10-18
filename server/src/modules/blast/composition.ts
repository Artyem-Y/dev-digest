import type { Container } from '../../platform/container.js';
import { BlastRepository } from './repository.js';
import { BlastService } from './service.js';

export function createBlastService(container: Container): BlastService {
  return new BlastService(new BlastRepository(container.db), container.repoIntel);
}
