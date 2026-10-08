import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface SettingsRepositoryPort {
  list(workspaceId: string): Promise<SettingRow[]>;
  upsert(workspaceId: string, userId: string, values: Record<string, unknown>): Promise<void>;
}

/** Drizzle adapter for non-secret workspace preferences. */
export class SettingsRepository implements SettingsRepositoryPort {
  constructor(private readonly db: Db) {}

  async list(workspaceId: string): Promise<SettingRow[]> {
    return this.db.select({ key: t.settings.key, value: t.settings.value })
      .from(t.settings)
      .where(eq(t.settings.workspaceId, workspaceId));
  }

  async upsert(workspaceId: string, userId: string, values: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await this.db.insert(t.settings).values({ workspaceId, userId, key, value })
        .onConflictDoUpdate({
          target: [t.settings.workspaceId, t.settings.userId, t.settings.key],
          set: { value },
        });
    }
  }
}
