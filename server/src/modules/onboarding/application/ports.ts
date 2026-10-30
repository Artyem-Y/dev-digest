import type { OnboardingIndexSnapshot } from '../../repo-intel/types.js';
export interface OnboardingIndexPort { getOnboardingSnapshot(repoId: string): Promise<OnboardingIndexSnapshot | null> }
export interface OnboardingSourcePort { readonly revision: string; available(): Promise<boolean>; read(path: string): Promise<string | null> }

import type { LLMProvider } from '@devdigest/shared';
import type { collectOnboardingFacts } from './collect-facts.js';
export type CollectedFacts = Awaited<ReturnType<typeof collectOnboardingFacts>>;
export type AttemptOwner = { id: string; token: string };
export type AttemptUsage = { call_count: 0 | 1; input_tokens: number | null; output_tokens: number | null; cost_usd: number | null };
export interface TourRepositoryPort {
  get(workspaceId: string, repoId: string): Promise<{ tour: { json: unknown } | null; attempt: unknown } | null>;
  admit(workspaceId: string, repoId: string, leaseMs: number): Promise<AttemptOwner | null>;
  finish(workspaceId: string, repoId: string, id: string, token: string, status: 'generated' | 'partial' | 'failed' | 'cancelled', result: unknown | null, reason: string | null, usage: AttemptUsage): Promise<boolean>;
}
export interface GenerateTourPorts {
  repository: TourRepositoryPort;
  collect(workspaceId: string, repoId: string): Promise<CollectedFacts>;
  resolveProvider(workspaceId: string): Promise<{ provider: LLMProvider; model: string } | null>;
  log(data: { outcome: string; reason: string | null; usage: AttemptUsage; diagnostic?: { kind: string; status: number | null; hints: string[] } }): void;
}
