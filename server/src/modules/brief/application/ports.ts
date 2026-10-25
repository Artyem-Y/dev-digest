import type { BlastRadius, BriefCacheResponse, BriefSourceStatus, FeatureModelChoice, LLMProvider } from '@devdigest/shared';
import type { ResolvedBriefContext } from '../../project-context/domain/types.js';
import type { BriefCacheRecord, BriefPullSnapshot } from '../domain/types.js';

export interface BriefReadPort {
  getSnapshot(workspaceId: string, prId: string): Promise<BriefPullSnapshot | undefined>;
  getCache(workspaceId: string, prId: string): Promise<BriefCacheRecord | undefined>;
  replace(workspaceId: string, prId: string, record: BriefCacheRecord): Promise<void>;
}
export interface BriefDependencies {
  read: BriefReadPort;
  projectContext: { resolve(input: { workspaceId: string; repoId: string }): Promise<ResolvedBriefContext> };
  featureModels: { resolve(workspaceId: string): Promise<FeatureModelChoice> };
  llm: { resolve(provider: FeatureModelChoice['provider']): Promise<LLMProvider> };
  blast?: { resolve(snapshot: BriefPullSnapshot): Promise<BlastRadius> };
}
export type BriefResponse = { cache: BriefCacheResponse; sources: BriefSourceStatus[] };
