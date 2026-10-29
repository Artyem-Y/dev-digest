import type { Container } from '../../platform/container.js';
import { RepoIntelRepository } from '../repo-intel/repository.js';
import { createProjectContextRepository } from '../project-context/composition.js';
import { SettingsRepository } from '../settings/repository.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { RevisionSourceReader } from './infrastructure/source-reader.js';
import { OnboardingRepository } from './infrastructure/onboarding.repository.js';
import { collectOnboardingFacts } from './application/collect-facts.js';
import { GenerateTour } from './application/generate-tour.js';
import { GetTour } from './application/get-tour.js';
import type { GenerateTourPorts } from './application/ports.js';

export function createOnboardingServices(container: Container, log: GenerateTourPorts['log']) {
  const repository = new OnboardingRepository(container.db);
  const index = new RepoIntelRepository(container.db);
  const projects = createProjectContextRepository(container);
  const collect: GenerateTourPorts['collect'] = async (workspaceId, repoId) => {
    // This lookup joins through the workspace before any checkout is opened.
    const checkout = await projects.clonePath(workspaceId, repoId);
    const snapshot = await index.getOnboardingSnapshot(repoId);
    const revision = snapshot.state?.lastIndexedSha;
    const source = checkout && revision && /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(revision) ? new RevisionSourceReader(checkout, revision) : null;
    return collectOnboardingFacts({ getOnboardingSnapshot: async () => snapshot }, source, repoId);
  };
  const resolveProvider: GenerateTourPorts['resolveProvider'] = async (workspaceId) => {
    try {
      const model = await resolveFeatureModel(new SettingsRepository(container.db), workspaceId, 'onboarding');
      return { model: model.model, provider: await container.llm(model.provider) };
    } catch { return null; }
  };
  const get = new GetTour(repository, async (repoId) => (await index.getOnboardingSnapshot(repoId)).state?.lastIndexedSha || null);
  return {
    readFile: (workspaceId: string, repoId: string, path: string, revision: string) => readTourFile({ get, projects, workspaceId, repoId, path, revision }),
    recoverExpired: () => repository.expireAbandoned(),
    get,
    generate: new GenerateTour({ repository, collect, resolveProvider, log }),
  };
}

export async function readTourFile(input: { get: Pick<GetTour, 'get'>; projects: { clonePath(workspaceId: string, repoId: string): Promise<string | null> }; workspaceId: string; repoId: string; path: string; revision: string; read?: (checkout: string, revision: string, path: string) => Promise<string | null> }) {
  const { get, projects, workspaceId, repoId, path, revision } = input;
  const result = await get.get(workspaceId, repoId);
  if (!result?.tour || result.tour.source_revision !== revision) return null;
  const allowed = result.tour.sections.some((section) => section.items.some((item) => item.kind === 'path' && item.text === path));
  if (!allowed) return null;
  const checkout = await projects.clonePath(workspaceId, repoId);
  if (!checkout || !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(revision)) return null;
  const read = input.read ?? ((dir, rev, file) => new RevisionSourceReader(dir, rev).read(file));
  const content = await read(checkout, revision, path);
  return content === null ? null : { path, revision, content };
}
