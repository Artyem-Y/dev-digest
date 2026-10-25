import type { Container } from '../../platform/container.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { SettingsRepository } from '../settings/repository.js';
import { createProjectContextRepository, createTrackedDocumentStore } from '../project-context/composition.js';
import { resolveBriefContext } from '../project-context/application/resolve-brief-context.js';
import { mapBlastResult } from '../blast/application/map-blast-radius.js';
import { BriefInFlight } from './domain/in-flight.js';
import { GenerateBrief } from './application/generate-brief.js';
import { GetBrief } from './application/get-brief.js';
import { DrizzleBriefRepository } from './infrastructure/brief.repository.js';

const inFlight = new BriefInFlight();

export function createBriefServices(container: Container) {
  const read = new DrizzleBriefRepository(container.db);
  const contextRepository = createProjectContextRepository(container);
  const dependencies = {
    read,
    projectContext: {
      resolve: async ({ workspaceId, repoId }: { workspaceId: string; repoId: string }) => {
        const checkoutPath = await contextRepository.clonePath(workspaceId, repoId);
        if (!checkoutPath) return { documents: [], skipped: [] };
        return resolveBriefContext({ workspaceId, repoId, repository: contextRepository, store: createTrackedDocumentStore(checkoutPath) });
      },
    },
    featureModels: { resolve: (workspaceId: string) => resolveFeatureModel(new SettingsRepository(container.db), workspaceId, 'risk_brief') },
    llm: { resolve: (provider: 'openai' | 'anthropic' | 'openrouter') => container.llm(provider) },
    blast: { resolve: async (snapshot: { repoId: string; files: { path: string }[] }) => mapBlastResult(await container.repoIntel.getBlastRadius(snapshot.repoId, snapshot.files.map((file) => file.path))) },
  };
  return { get: new GetBrief(read), generate: new GenerateBrief(dependencies, inFlight) };
}
