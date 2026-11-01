import { z } from 'zod';

export const EvalAnchor = z.object({ file: z.string().min(1), start_line: z.number().int().positive(), end_line: z.number().int().positive() });
export const EvalExpectation = z.enum(['must_find', 'must_not_flag']);
export const EvalPipelineCase = z.object({
  id: z.string().uuid(), agent_id: z.string().uuid(), name: z.string(), finding_id: z.string().uuid().nullable(),
  expectation: EvalExpectation, anchor: EvalAnchor, fixture_id: z.string(), fixture_hash: z.string(),
});
export const EvalPipelineCounts = z.object({ positive: z.number().int(), truePositive: z.number().int(), knownFalsePositive: z.number().int(), unlabeled: z.number().int(), grounded: z.number().int(), dropped: z.number().int() });
export const EvalPipelineScore = z.object({
  recall: z.number().nullable(), precision: z.number().nullable(), citationAccuracy: z.number().nullable(),
  counts: EvalPipelineCounts,
  cases: z.array(z.object({ passed: z.boolean(), matched: z.boolean(), unlabeled: z.number().int() })),
});
export const EvalPipelineCaseSnapshot = z.object({
  id: z.string(), expectation: EvalExpectation, anchor: z.object({ file: z.string(), startLine: z.number(), endLine: z.number() }),
  fixtureId: z.string(), fixtureHash: z.string(),
});
export const EvalPromotionSnapshot = z.object({
  name: z.string(), description: z.string(), provider: z.enum(['openai', 'anthropic', 'openrouter']), model: z.string(), systemPrompt: z.string(),
  outputSchema: z.unknown(), strategy: z.enum(['auto', 'single-pass', 'map-reduce']), ciFailOn: z.enum(['never', 'critical', 'warning', 'any']), repoIntel: z.boolean(), enabled: z.boolean(),
  links: z.array(z.object({ id: z.string().uuid(), order: z.number().int(), enabled: z.boolean(), skillEnabled: z.boolean(), bodyHash: z.string().regex(/^[a-f0-9]{64}$/) })),
}).refine((value) => Object.prototype.hasOwnProperty.call(value, 'outputSchema'));
export const EvalPipelineSnapshot = z.object({
  agent: z.object({ systemPrompt: z.string(), provider: z.string(), model: z.string(), strategy: z.string(), skills: z.array(z.string()) }),
  cases: z.array(EvalPipelineCaseSnapshot),
  promotion: EvalPromotionSnapshot.optional(),
});
export const EvalPipelineResult = z.object({
  status: z.enum(['completed', 'failed']), results: z.array(z.discriminatedUnion('status', [
    z.object({ caseId: z.string(), status: z.literal('completed'), grounded: z.array(z.object({ file: z.string(), startLine: z.number(), endLine: z.number() })), dropped: z.number(), costUsd: z.number().nullable(), durationMs: z.number() }),
    z.object({ caseId: z.string(), status: z.literal('failed'), error: z.enum(['review_failed', 'timeout']), durationMs: z.number() }),
  ])), score: EvalPipelineScore.nullable(), costUsd: z.number().nullable(),
});
export const EvalPipelineRun = z.object({
  id: z.string().uuid(), agent_id: z.string().uuid(), status: z.enum(['queued', 'running', 'completed', 'failed']),
  dataset_fingerprint: z.string(), engine_version: z.string(), scorer_version: z.string(),
  snapshot: EvalPipelineSnapshot, result: EvalPipelineResult.nullable(), created_at: z.string(), finished_at: z.string().nullable(),
});
export type EvalPipelineCase = z.infer<typeof EvalPipelineCase>;
export type EvalPipelineRun = z.infer<typeof EvalPipelineRun>;
