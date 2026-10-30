import { describe, expect, it } from 'vitest';
import { OnboardingTourResponse, OnboardingTourSections } from '../src/vendor/shared/contracts/onboarding-tour.js';

const section = (id: string) => ({ id, items: [], unavailable_reason: null });
const sections = ['architecture', 'critical_paths', 'local_run', 'reading_path', 'first_tasks'].map(section);
const result = {
  repo_id: 'repo-1', sections, status: 'partial', source_revision: null,
  index_revision: null, index_state: 'unavailable', freshness: 'unknown',
  generated_at: '2026-10-29T12:00:00Z', limitations: [],
  counts: { indexed_files: null, selected_files: 0, omitted_files: null, estimated_tokens: 0 },
  usage: { call_count: 0, input_tokens: null, output_tokens: null, cost_usd: null },
};

describe('onboarding tour contract', () => {
  it('requires exactly five sections in order', () => {
    expect(OnboardingTourSections.safeParse(sections).success).toBe(true);
    expect(OnboardingTourSections.safeParse([...sections].reverse()).success).toBe(false);
    expect(OnboardingTourSections.safeParse(sections.slice(0, 4)).success).toBe(false);
  });
  it('preserves unknown usage separately from zero and separates attempts', () => {
    const parsed = OnboardingTourResponse.parse({ tour: result, attempt: { id: 'attempt-1', status: 'pending', reason: null, retryable: false, usage: { call_count: 0, input_tokens: 0, output_tokens: null, cost_usd: 0 } } });
    expect(parsed.tour?.usage.input_tokens).toBeNull();
    expect(parsed.attempt?.usage.input_tokens).toBe(0);
    expect(parsed.attempt?.usage.cost_usd).toBe(0);
    expect(OnboardingTourResponse.safeParse({ tour: null, attempt: null }).success).toBe(true);
  });
  it('rejects malformed fact references and unsafe failure codes', () => {
    const bad = structuredClone(result);
    bad.sections[0] = { ...bad.sections[0]!, items: [{ text: 'claim', fact_ids: [''], kind: 'observation' }] } as typeof bad.sections[0];
    expect(OnboardingTourResponse.safeParse({ tour: bad, attempt: null }).success).toBe(false);
    expect(OnboardingTourResponse.safeParse({ tour: null, attempt: { id: 'a', status: 'failed', reason: 'raw error', retryable: true, usage: result.usage } }).success).toBe(false);
  });
});
