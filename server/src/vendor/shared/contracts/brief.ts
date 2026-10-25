import { z } from 'zod';

/**
 * PR Brief building blocks: Intent, Blast radius, Risks, PR History,
 * Smart Diff. Composed into PrBrief.
 */

// ---- Intent ----
export const Intent = z.object({
  intent: z.string(),
  in_scope: z.array(z.string()),
  out_of_scope: z.array(z.string()),
});
export type Intent = z.infer<typeof Intent>;

/** Trace-safe provenance only; source text and URLs are never transport data. */
export const IntentEvidence = z.object({
  source_kind: z.enum(['pr_title', 'pr_description', 'github_issue', 'plan_spec']),
  status: z.enum(['used', 'unused', 'unavailable', 'rejected']),
  reason_code: z.string().max(80).nullable(),
  content_fingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
});
export type IntentEvidence = z.infer<typeof IntentEvidence>;

export const DerivedIntent = Intent.extend({
  confidence: z.enum(['high', 'medium', 'low']),
  evidence: z.array(IntentEvidence).max(8),
  source_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  model_provider: z.enum(['openai', 'anthropic', 'openrouter']),
  model: z.string().min(1),
  derived_at: z.string().datetime(),
});
export type DerivedIntent = z.infer<typeof DerivedIntent>;

// ---- Blast radius ----
export const ChangedSymbol = z.object({
  name: z.string(),
  file: z.string(),
  kind: z.string(),
});
export type ChangedSymbol = z.infer<typeof ChangedSymbol>;

export const BlastCaller = z.object({
  name: z.string(),
  file: z.string(),
  line: z.number().int(),
});
export type BlastCaller = z.infer<typeof BlastCaller>;

/** Raw repo-intel caller edge retained for MCP consumers. */
export const BlastCallerEdge = z.object({
  file: z.string(),
  symbol: z.string(),
  viaSymbol: z.string(),
  line: z.number().int(),
  rank: z.number(),
});
export type BlastCallerEdge = z.infer<typeof BlastCallerEdge>;

export const DownstreamImpact = z.object({
  symbol: z.string(),
  callers: z.array(BlastCaller),
  endpoints_affected: z.array(z.string()),
  crons_affected: z.array(z.string()),
});
export type DownstreamImpact = z.infer<typeof DownstreamImpact>;

export const BlastDegradedReason = z.enum([
  'flag_off',
  'index_failed',
  'index_partial',
  'repo_too_large',
  'no_data',
]);
export type BlastDegradedReason = z.infer<typeof BlastDegradedReason>;

// ---- PR History ----
export const PrHistoryItem = z.object({
  pr_number: z.number().int(),
  title: z.string(),
  merged_at: z.string(),
  author: z.string(),
  files_overlap: z.array(z.string()),
  notes: z.string(),
});
export type PrHistoryItem = z.infer<typeof PrHistoryItem>;

export const PrHistory = z.object({
  history: z.array(PrHistoryItem),
});
export type PrHistory = z.infer<typeof PrHistory>;

export const BlastRadius = z.object({
  changed_symbols: z.array(ChangedSymbol),
  /** Raw repo-intel names retained for the MCP response. */
  changedSymbols: z.array(ChangedSymbol).optional(),
  callers: z.array(BlastCallerEdge).optional(),
  downstream: z.array(DownstreamImpact),
  summary: z.string(),
  degraded: z.boolean().default(false),
  reason: BlastDegradedReason.nullable().default(null),
  /** Null means the optional GitHub history lookup was unavailable. */
  prior_prs: PrHistory.nullish(),
});
export type BlastRadius = z.infer<typeof BlastRadius>;

// ---- Risks ----
export const RiskSeverity = z.enum(['high', 'medium', 'low']);
export type RiskSeverity = z.infer<typeof RiskSeverity>;

export const Risk = z.object({
  kind: z.string(),
  title: z.string(),
  explanation: z.string(),
  severity: RiskSeverity,
  file_refs: z.array(z.string()),
});
export type Risk = z.infer<typeof Risk>;

export const Risks = z.object({
  risks: z.array(Risk),
});
export type Risks = z.infer<typeof Risks>;

// ---- PR Brief transport ----
/** A path that is safe to resolve only within the repository checkout. */
export const RepositoryRelativePath = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !path.startsWith('\\') &&
      !/^[A-Za-z]:/.test(path) &&
      !path.split(/[\\/]/).includes('..'),
    'must be a repository-relative path without traversal',
  );
export type RepositoryRelativePath = z.infer<typeof RepositoryRelativePath>;

export const BriefReviewFocus = z
  .object({
    file: RepositoryRelativePath,
    line: z.number().int().positive(),
    reason: z.string().min(1),
  })
  .strict();
export type BriefReviewFocus = z.infer<typeof BriefReviewFocus>;

/** Risk data persisted inside a brief keeps every file reference checkout-relative. */
export const BriefRisk = Risk.extend({
  file_refs: z.array(RepositoryRelativePath),
}).strict();
export type BriefRisk = z.infer<typeof BriefRisk>;

export const BriefRisks = Risks.extend({
  risks: z.array(BriefRisk),
}).strict();
export type BriefRisks = z.infer<typeof BriefRisks>;

/** Trace-safe source metadata. Source content and provider internals never cross this boundary. */
export const BriefSourceStatus = z
  .object({
    source_kind: z.enum([
      'pr_title',
      'pr_description',
      'changed_file',
      'repository_file',
      'spec',
      'intent',
      'blast_radius',
      'smart_diff',
    ]),
    path: RepositoryRelativePath.nullable(),
    provenance: z.enum(['pull_request', 'changed_files', 'tracked_checkout']),
    status: z.enum(['available', 'omitted', 'unavailable', 'rejected']),
    reason_code: z.string().min(1).max(80).nullable(),
    estimated_tokens: z.number().int().nonnegative(),
  })
  .strict();
export type BriefSourceStatus = z.infer<typeof BriefSourceStatus>;

// ---- Smart Diff ----
export const SmartDiffRole = z.enum(['core', 'tests', 'wiring', 'docs', 'boilerplate']);
export type SmartDiffRole = z.infer<typeof SmartDiffRole>;

export const SmartDiffFile = z.object({
  path: z.string(),
  pseudocode_summary: z.string().nullish(),
  additions: z.number().int(),
  deletions: z.number().int(),
  finding_lines: z.array(z.number().int()),
});
export type SmartDiffFile = z.infer<typeof SmartDiffFile>;

export const SmartDiffGroup = z.object({
  role: SmartDiffRole,
  files: z.array(SmartDiffFile),
});
export type SmartDiffGroup = z.infer<typeof SmartDiffGroup>;

export const ProposedSplit = z.object({
  name: z.string(),
  files: z.array(z.string()),
});
export type ProposedSplit = z.infer<typeof ProposedSplit>;

export const SmartDiff = z.object({
  groups: z.array(SmartDiffGroup),
  split_suggestion: z.object({
    too_big: z.boolean(),
    total_lines: z.number().int(),
    proposed_splits: z.array(ProposedSplit),
  }),
});
export type SmartDiff = z.infer<typeof SmartDiff>;

// ---- Composed PR Brief (pr_brief.json) ----
export const PrBrief = z.object({
  summary: z.string().min(1),
  review_focus: z.array(BriefReviewFocus),
  head_sha: z.string().min(1),
  intent: Intent,
  blast: BlastRadius,
  risks: BriefRisks,
  history: PrHistory,
}).strict();
export type PrBrief = z.infer<typeof PrBrief>;

/** Exact legacy pr_brief JSON retained only for stale-cache classification and regeneration. */
export const LegacyPrBrief = z
  .object({
    intent: Intent,
    blast: BlastRadius,
    risks: Risks,
    history: PrHistory,
  });
export type LegacyPrBrief = z.infer<typeof LegacyPrBrief>;

/** Version-tolerant persisted cache parser; API responses still require the current Brief shape. */
export const StoredPrBrief = z.union([PrBrief, LegacyPrBrief]);
export type StoredPrBrief = z.infer<typeof StoredPrBrief>;

/** Generated, review-ready PR context. The focus array preserves priority order. */
export const Brief = PrBrief;
export type Brief = z.infer<typeof Brief>;

export const BriefCacheResponse = z.discriminatedUnion('cache_state', [
  z.object({ cache_state: z.literal('missing') }).strict(),
  z.object({ cache_state: z.literal('current'), brief: Brief }).strict(),
  z.object({ cache_state: z.literal('stale'), brief: Brief }).strict(),
]);
export type BriefCacheResponse = z.infer<typeof BriefCacheResponse>;
