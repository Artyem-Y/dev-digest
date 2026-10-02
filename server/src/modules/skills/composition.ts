import type { Container } from '../../platform/container.js';
import { SkillsRepository } from './repository.js';
import { SkillsService } from './service.js';

export function createSkillsService(container: Container) {
  return new SkillsService(new SkillsRepository(container.db));
}
