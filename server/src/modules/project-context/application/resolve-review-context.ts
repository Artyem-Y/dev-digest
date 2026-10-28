import { resolveBriefContext } from './resolve-brief-context.js';
import type { TrackedDocumentStore } from './ports.js';
import type { ProjectContextAttachment } from '../domain/types.js';

export async function resolveReviewContext(input: {
  workspaceId: string;
  repoId: string;
  agentId: string;
  repository: { listForAgent(workspaceId: string, repoId: string, agentId: string): Promise<ProjectContextAttachment[]> };
  store: TrackedDocumentStore;
}) {
  return resolveBriefContext({
    workspaceId: input.workspaceId,
    repoId: input.repoId,
    repository: { listForBrief: () => input.repository.listForAgent(input.workspaceId, input.repoId, input.agentId) },
    store: input.store,
    preserveOrder: true,
  });
}
