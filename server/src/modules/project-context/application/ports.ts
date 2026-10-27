import type { ProjectContextAttachment, SkipReason } from '../domain/types.js';

export interface ProjectContextRepository {
  listForBrief(workspaceId: string, repoId: string): Promise<ProjectContextAttachment[]>;
}

export type DocumentRead = { path: string; content: string } | { path: string; reason: SkipReason };

/** A catalogued checkout read boundary. Callers cannot request arbitrary paths. */
export interface TrackedDocumentStore {
  catalog(): Promise<string[]>;
  read(path: string): Promise<DocumentRead>;
}
