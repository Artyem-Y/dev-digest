import type { WorkspaceRepositoryPort } from './repository.js';

/** Application mapping for the workspace overview endpoint. */
export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepositoryPort, private readonly cloneDir: string) {}

  async summary(workspaceId: string) {
    const repos = await this.repository.list(workspaceId);
    return {
      workspaceId,
      cloneDir: this.cloneDir,
      repos: repos.map((repo) => ({
        id: repo.id,
        full_name: repo.fullName,
        clone_path: repo.clonePath,
        last_polled_at: repo.lastPolledAt?.toISOString() ?? null,
        cloned: Boolean(repo.clonePath),
      })),
    };
  }
}
