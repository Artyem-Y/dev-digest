import { z } from 'zod';

export const ONBOARDING_TOUR_SECTION_IDS = [
  'architecture', 'critical_paths', 'local_run', 'reading_path', 'first_tasks',
] as const;
export const OnboardingTourSectionId = z.enum(ONBOARDING_TOUR_SECTION_IDS);
export type OnboardingTourSectionId = z.infer<typeof OnboardingTourSectionId>;

// Fact IDs are opaque references to evidence captured for this generation.
export const OnboardingFactId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/).max(128);
export const OnboardingTourItem = z.object({
  kind: z.enum(['observation', 'path', 'command', 'route', 'dependency', 'suggestion']),
  text: z.string().min(1),
  description: z.string().min(1).optional(),
  fact_ids: z.array(OnboardingFactId).min(1),
});
export type OnboardingTourItem = z.infer<typeof OnboardingTourItem>;

const section = <T extends OnboardingTourSectionId>(id: T) => z.object({
  id: z.literal(id),
  items: z.array(OnboardingTourItem),
  narrative: z.array(z.object({ text: z.string().min(1), fact_ids: z.array(OnboardingFactId).min(1) })).optional(),
  unavailable_reason: z.string().min(1).nullable(),
});
export const OnboardingTourSections = z.tuple([
  section('architecture'), section('critical_paths'), section('local_run'),
  section('reading_path'), section('first_tasks'),
]);
export type OnboardingTourSections = z.infer<typeof OnboardingTourSections>;

export const OnboardingUsage = z.object({
  call_count: z.union([z.literal(0), z.literal(1)]),
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  cost_usd: z.number().finite().nonnegative().nullable(),
});
export type OnboardingUsage = z.infer<typeof OnboardingUsage>;
export const OnboardingCounts = z.object({
  indexed_files: z.number().int().nonnegative().nullable(),
  selected_files: z.number().int().nonnegative(),
  omitted_files: z.number().int().nonnegative().nullable(),
  estimated_tokens: z.number().int().nonnegative(),
});
export type OnboardingCounts = z.infer<typeof OnboardingCounts>;
export const OnboardingFailureCode = z.enum([
  'source_unavailable', 'index_unavailable', 'authorization_failed', 'provider_unavailable',
  'provider_failed', 'provider_request_rejected', 'provider_billing_required', 'provider_auth_failed', 'provider_rate_limited', 'provider_no_response', 'provider_connection_failed', 'provider_internal_error', 'invalid_response', 'timeout', 'cancelled', 'storage_failed',
]);
export type OnboardingFailureCode = z.infer<typeof OnboardingFailureCode>;
export const OnboardingTour = z.object({
  repo_id: z.string().min(1),
  sections: OnboardingTourSections,
  status: z.enum(['generated', 'partial']),
  source_revision: z.string().min(1).nullable(),
  index_revision: z.string().min(1).nullable(),
  index_state: z.enum(['ready', 'incomplete', 'stale', 'degraded', 'unavailable']),
  freshness: z.enum(['current', 'stale', 'unknown']),
  generated_at: z.string().datetime({ offset: true }),
  limitations: z.array(z.string().min(1)),
  counts: OnboardingCounts,
  usage: OnboardingUsage,
});
export type OnboardingTour = z.infer<typeof OnboardingTour>;
export const OnboardingAttempt = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'generated', 'partial', 'failed', 'cancelled']),
  reason: OnboardingFailureCode.nullable(),
  retryable: z.boolean(),
  usage: OnboardingUsage,
});
export type OnboardingAttempt = z.infer<typeof OnboardingAttempt>;
export const OnboardingTourResponse = z.object({
  tour: OnboardingTour.nullable(),
  attempt: OnboardingAttempt.nullable(),
});
export type OnboardingTourResponse = z.infer<typeof OnboardingTourResponse>;
