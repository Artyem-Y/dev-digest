import type { DerivedIntent, LLMProvider, Provider } from '@devdigest/shared';

export type IntentRepoRef = { owner: string; name: string };

export type PublicDocumentResult =
  | { ok: true; text: string }
  | { ok: false; reasonCode: string };

export interface PublicDocumentFetcher {
  fetchPlanOrSpec(candidate: string): Promise<PublicDocumentResult>;
}

export interface IntentRepositoryPort {
  getDerivedIntent(prId: string): Promise<DerivedIntent | undefined>;
  upsertDerivedIntent(prId: string, intent: DerivedIntent): Promise<void>;
}

export interface LinkedIssueReader {
  findLinkedIssue(repo: IntentRepoRef, prBody: string | null): Promise<{ title: string; body: string | null } | undefined>;
}

export interface FeatureModelResolver {
  resolve(workspaceId: string): Promise<{ provider: Provider; model: string }>;
}

export interface IntentLlmResolver {
  resolve(provider: Provider): Promise<LLMProvider>;
}
