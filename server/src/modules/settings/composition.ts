import type { Container } from '../../platform/container.js';
import { SettingsRepository } from './repository.js';
import { SettingsService } from './service.js';

export function createSettingsService(container: Container): SettingsService {
  return new SettingsService(
    new SettingsRepository(container.db),
    container.secrets,
    () => container.github(),
    (provider) => container.llm(provider),
    () => container.invalidateSecretCaches(),
  );
}
