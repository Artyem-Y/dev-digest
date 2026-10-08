import type {
  ConnTestProvider,
  ConnTestResult,
  SecretsProvider,
  SecretsStatus,
  Settings,
  SettingsUpdate,
} from '@devdigest/shared';
import { GITHUB_PROVIDER, SECRET_KEY_BY_PROVIDER } from './constants.js';
import { rowsToSettings } from './helpers.js';
import type { SettingsRepositoryPort } from './repository.js';

export interface GitHubConnectionPort { currentLogin(): Promise<string>; }
export interface LlmConnectionPort { listModels(): Promise<unknown[]>; }
export type GitHubConnectionResolver = () => Promise<GitHubConnectionPort>;
export type LlmConnectionResolver = (provider: Exclude<ConnTestProvider, 'github'>) => Promise<LlmConnectionPort>;

/** Application workflows for non-secret settings and provider connectivity. */
export class SettingsService {
  constructor(
    private readonly repository: SettingsRepositoryPort,
    private readonly secrets: SecretsProvider,
    private readonly github: GitHubConnectionResolver,
    private readonly llm: LlmConnectionResolver,
    private readonly invalidateSecretCaches: () => void,
  ) {}

  async list(workspaceId: string): Promise<Settings> {
    return rowsToSettings(await this.repository.list(workspaceId));
  }

  async secretsStatus(): Promise<SecretsStatus> {
    const entries = await Promise.all(
      (Object.entries(SECRET_KEY_BY_PROVIDER) as [keyof SecretsStatus, Parameters<SecretsProvider['get']>[0]][])
        .map(async ([provider, key]) => [provider, Boolean(await this.secrets.get(key))] as const),
    );
    return Object.fromEntries(entries) as SecretsStatus;
  }

  async update(workspaceId: string, userId: string, update: SettingsUpdate): Promise<Settings> {
    await this.repository.upsert(workspaceId, userId, update);
    return this.list(workspaceId);
  }

  async testConnection(provider: ConnTestProvider, key?: string): Promise<ConnTestResult> {
    try {
      if (key) {
        if (!this.secrets.set) return { provider, ok: false, message: 'Secrets backend is read-only' };
        await this.secrets.set(SECRET_KEY_BY_PROVIDER[provider], key);
        this.invalidateSecretCaches();
      }
      if (provider === GITHUB_PROVIDER) {
        const login = await (await this.github()).currentLogin();
        return { provider, ok: true, message: `Connected as @${login}` };
      }
      const models = await (await this.llm(provider)).listModels();
      return { provider, ok: true, message: `OK — ${models.length} models available` };
    } catch (error) {
      return { provider, ok: false, message: (error as Error).message };
    }
  }
}
