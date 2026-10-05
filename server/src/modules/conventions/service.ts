import { z } from 'zod';
import { resolveFeatureModel } from '../settings/feature-models.js';
import type { LLMProvider } from '@devdigest/shared';
import type { RepoIntel } from '../repo-intel/types.js';
import type { SettingsRepositoryPort } from '../settings/repository.js';
import type { RepoRepositoryPort } from '../repos/service.js';
import { NotFoundError, AppError } from '../../platform/errors.js';
import { verifyConventionEvidence, type VerifiedConventionEvidence } from './application/verify-evidence.js';

const Extraction = z.object({
  candidates: z.array(z.object({
    category: z.string().trim().min(1).max(80),
    rule: z.string().trim().min(1).max(800),
    evidence_path: z.string().trim().min(1).max(500),
    evidence_line: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
  })).max(30),
});

type PersistedCandidate = {
  category: string; rule: string; evidencePath: string; evidenceLine: number; evidenceSnippet: string; confidence: number;
};

export interface ConventionsServiceDependencies {
  repository: {
    list(workspaceId: string, repoId: string): Promise<unknown[]>;
    replace(workspaceId: string, repoId: string, rows: PersistedCandidate[]): Promise<unknown[]>;
    setStatus(workspaceId: string, repoId: string, id: string, status: 'pending' | 'accepted' | 'rejected', rule?: string): Promise<unknown>;
  };
  repos: Pick<RepoRepositoryPort, 'getById'>;
  repoIntel: Pick<RepoIntel, 'getConventionSamples'>;
  configSamples(cloneRoot: string): Promise<string[]>;
  settings: Pick<SettingsRepositoryPort, 'list'>;
  llm(provider: 'openai' | 'anthropic' | 'openrouter'): Promise<LLMProvider>;
  readSample(path: string, cloneRoot: string): Promise<string>;
  verifyEvidence?: (root: string, sampled: ReadonlySet<string>, path: string, line: number) => Promise<VerifiedConventionEvidence | null>;
}

export class ConventionsService {
  constructor(private readonly dependencies: ConventionsServiceDependencies) {}

  async list(workspaceId: string, repoId: string) { return this.dependencies.repository.list(workspaceId, repoId); }

  async repo(workspaceId: string, repoId: string) {
    const repo = await this.dependencies.repos.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repository not found');
    return repo;
  }

  async scan(workspaceId: string, repoId: string) {
    const repo = await this.repo(workspaceId, repoId);
    if (!repo.clonePath) throw new AppError('repo_not_cloned', 'Repository has not been cloned yet', 409);

    const ranked = await this.dependencies.repoIntel.getConventionSamples(repoId, 12);
    const configPaths = await this.dependencies.configSamples(repo.clonePath!);
    const paths = [...configPaths, ...ranked].filter((path, index, all) => all.indexOf(path) === index);
    const samples = await Promise.all(paths.map(async (path) => {
      const content = await this.dependencies.readSample(path, repo.clonePath!).catch(() => '');
      return content ? `FILE: ${path}\n${content.slice(0, 16_000)}` : '';
    }));
    const usablePaths = paths.filter((_path, index) => samples[index]);
    if (!usablePaths.length) return this.dependencies.repository.replace(workspaceId, repoId, []);

    const model = await resolveFeatureModel(this.dependencies.settings, workspaceId, 'conventions');
    const provider = await this.dependencies.llm(model.provider);
    const result = await provider.completeStructured({
      model: model.model,
      schema: Extraction,
      schemaName: 'convention_extraction',
      temperature: 0,
      maxTokens: 3_000,
      messages: [
        { role: 'system', content: 'Extract recurring repository conventions. Return only rules supported by a supplied file and exact 1-based line. Do not invent evidence.' },
        { role: 'user', content: samples.filter(Boolean).join('\n\n---\n\n') },
      ],
    });

    const verify = this.dependencies.verifyEvidence ?? verifyConventionEvidence;
    const sampled = new Set(usablePaths);
    const verified = (await Promise.all(result.data.candidates.map(async (candidate) => {
      const evidence = await verify(repo.clonePath!, sampled, candidate.evidence_path, candidate.evidence_line);
      return evidence ? { category: candidate.category, rule: candidate.rule, confidence: candidate.confidence, ...evidence } : null;
    }))).filter((candidate): candidate is PersistedCandidate => candidate !== null);
    return this.dependencies.repository.replace(workspaceId, repoId, verified);
  }

  async setStatus(workspaceId: string, repoId: string, id: string, status: 'pending' | 'accepted' | 'rejected', rule?: string) {
    const row = await this.dependencies.repository.setStatus(workspaceId, repoId, id, status, rule);
    if (!row) throw new NotFoundError('Convention not found');
    return row;
  }
}
