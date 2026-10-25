import type { Brief, BriefSourceStatus, BlastRadius, Intent, SmartDiff } from '@devdigest/shared';

export interface BriefPullSnapshot {
  id: string;
  repoId: string;
  headSha: string;
  title: string;
  body: string | null;
  number: number;
  additions: number;
  deletions: number;
  files: { path: string; additions: number; deletions: number }[];
  intent?: Intent;
  smartDiff?: SmartDiff;
  blast?: BlastRadius;
}

export interface BriefCacheRecord {
  brief: Brief;
  sources: BriefSourceStatus[];
  telemetry?: { provider: string; model: string; estimated_tokens: number; call_count: number; selected_documents: number; skipped_documents: number; selected_fact_sources: string[]; omitted_fact_sources: string[]; truncated_fact_sources: string[]; document_provenance: { path: string; provenance: string[] }[] };
}

export type BriefCacheState =
  | { cache_state: 'missing' }
  | { cache_state: 'current'; brief: Brief }
  | { cache_state: 'stale'; brief: Brief };
