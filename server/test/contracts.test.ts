import { describe, it, expect } from 'vitest';
import {
  Review,
  Finding,
  Intent,
  BlastRadius,
  Risks,
  PrHistory,
  SmartDiff,
  Conformance,
  Onboarding,
  EvalRun,
  MemoryItem,
  RunTrace,
  RunTraceResponse,
  RunSummary,
  Settings,
  Repo,
  PrDetail,
  PrBrief,
  LegacyPrBrief,
  StoredPrBrief,
  Brief,
  BriefCacheResponse,
  BriefGenerateResponse,
  BriefGenerationInProgressError,
  BriefSourceStatus,
} from '@devdigest/shared';

/**
 * Contract tests — parse/round-trip the fixtures from data.jsx/data2.jsx
 * so feature agents can rely on the schemas matching the prototype data.
 */
describe('AI contracts parse fixtures', () => {
  it('Review + Finding (data.jsx VERDICT/FINDINGS)', () => {
    const review = Review.parse({
      verdict: 'request_changes',
      summary: 'Two blockers before merge.',
      score: 61,
      findings: [
        {
          id: 'f1',
          severity: 'CRITICAL',
          category: 'security',
          title: 'Hardcoded Stripe secret key in commit',
          file: 'src/config.ts',
          start_line: 12,
          end_line: 12,
          rationale: 'Line 12 contains a literal `sk_live_` Stripe key.',
          suggestion: 'Move to env and rotate.',
          confidence: 0.98,
          kind: 'secret_leak',
        },
      ],
    });
    expect(review.findings).toHaveLength(1);
    expect(review.score).toBe(61);
  });

  it('lethal-trifecta Finding variant', () => {
    const f = Finding.parse({
      id: 'f2',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Lethal trifecta',
      file: 'src/api/public/webhooks.ts',
      start_line: 61,
      end_line: 74,
      rationale: 'all three legs present',
      confidence: 0.79,
      kind: 'lethal_trifecta',
      trifecta_components: ['private_data_access', 'untrusted_input', 'exfil_path'],
      evidence: [{ component: 'untrusted_input', file: 'src/api/public/webhooks.ts', line: 61 }],
    });
    expect(f.trifecta_components).toContain('exfil_path');
  });

  it('Intent / BlastRadius / Risks / PrHistory', () => {
    expect(() =>
      Intent.parse({ intent: 'x', in_scope: ['a'], out_of_scope: ['b'] }),
    ).not.toThrow();
    expect(() =>
      BlastRadius.parse({
        changed_symbols: [{ name: 'rateLimit', file: 'a.ts', kind: 'function' }],
        downstream: [
          {
            symbol: 'rateLimit',
            callers: [{ name: 'publicRouter', file: 'b.ts', line: 23 }],
            endpoints_affected: ['GET /x'],
            crons_affected: ['c'],
          },
        ],
        summary: 's',
      }),
    ).not.toThrow();
    expect(() =>
      Risks.parse({
        risks: [{ kind: 'security', title: 't', explanation: 'e', severity: 'high', file_refs: [] }],
      }),
    ).not.toThrow();
    expect(() =>
      PrHistory.parse({
        history: [
          {
            pr_number: 401,
            title: 't',
            merged_at: '2026-03-18',
            author: 'a',
            files_overlap: [],
            notes: 'n',
          },
        ],
      }),
    ).not.toThrow();
  });

  it('SmartDiff (data.jsx DIFF)', () => {
    const d = SmartDiff.parse({
      groups: [
        {
          role: 'core',
          files: [{ path: 'a.ts', additions: 84, deletions: 0, finding_lines: [28, 52] }],
        },
      ],
      split_suggestion: { too_big: false, total_lines: 285, proposed_splits: [] },
    });
    expect(d.groups[0]!.role).toBe('core');
  });

  it('SmartDiff accepts all five ordered file roles', () => {
    const roles = ['core', 'tests', 'wiring', 'docs', 'boilerplate'] as const;
    const value = SmartDiff.parse({
      groups: roles.map((role) => ({ role, files: [] })),
      split_suggestion: { too_big: false, total_lines: 0, proposed_splits: [] },
    });
    expect(value.groups.map((group) => group.role)).toEqual(roles);
    expect(SmartDiff.safeParse({ ...value, groups: [{ role: 'unknown', files: [] }] }).success).toBe(false);
  });

  it('Conformance / Onboarding / EvalRun / MemoryItem', () => {
    expect(() =>
      Conformance.parse({
        spec_id: 's1',
        spec_title: 'Spec',
        items: [{ requirement: 'r', status: 'implemented' }],
        completeness_pct: 80,
      }),
    ).not.toThrow();
    expect(() =>
      Onboarding.parse({
        sections: [{ kind: 'architecture', title: 'T', body: 'b', links: [] }],
      }),
    ).not.toThrow();
    expect(() =>
      EvalRun.parse({
        recall: 0.82,
        precision: 0.91,
        citation_accuracy: 0.95,
        traces_passed: 17,
        traces_total: 20,
        duration_ms: 12000,
        cost_usd: 0.23,
        per_trace: [{ name: 't01', pass: true, expected: 'x', actual: 'x' }],
      }),
    ).not.toThrow();
    expect(() =>
      MemoryItem.parse({
        content: 'c',
        scope: 'team',
        kind: 'decision',
        confidence: 0.92,
        sources: [{ pr: 401, context: 'ctx' }],
      }),
    ).not.toThrow();
  });

  it('RunTrace (data2.jsx TRACE single-document)', () => {
    const trace = RunTrace.parse({
      config: { agent: 'Security Reviewer', version: 'v7', model: 'gpt-4.1', pr: 482, source: 'local' },
      stats: { duration_ms: 8200, tokens_in: 14820, tokens_out: 1240, findings: 3, grounding: '3/3 passed' },
      prompt_assembly: { system: 's', user: 'u' },
      tool_calls: [{ tool: 'read_file', args: "'src/config.ts'", meta: '1,240 bytes', ms: 120 }],
      raw_output: '{}',
      memory_pulled: [{ pr: 288, text: 'verified via stripe-signature' }],
      specs_read: ['specs/security-baseline.md'],
      log: [{ t: '00.00', kind: 'info', msg: 'started' }],
    });
    expect(trace.tool_calls).toHaveLength(1);
  });

  it('RunTraceResponse adds nullable non-negative cost without changing stored trace', () => {
    const trace = {
      config: { agent: 'Security Reviewer', version: 'v7', model: 'gpt-4.1', pr: 482, source: 'local' },
      stats: { duration_ms: 8200, tokens_in: 14820, tokens_out: 1240, findings: 3, grounding: '3/3 passed' },
      prompt_assembly: { system: 's', user: 'u' },
      tool_calls: [],
      raw_output: '{}',
      memory_pulled: [],
      specs_read: [],
      log: [],
    };
    expect(RunTrace.parse(trace).stats).not.toHaveProperty('cost_usd');
    expect(RunTraceResponse.parse({ ...trace, stats: { ...trace.stats, cost_usd: 0.0013 } }).stats.cost_usd).toBe(0.0013);
    expect(RunTraceResponse.safeParse({ ...trace, stats: { ...trace.stats, cost_usd: -0.01 } }).success).toBe(false);
  });

  it('RunSummary accepts unknown cost and rejects a negative cost', () => {
    const summary = {
      run_id: 'run-1',
      agent_id: 'agent-1',
      agent_name: 'Security Reviewer',
      provider: 'openai',
      model: 'gpt-4.1',
      status: 'done',
      error: null,
      duration_ms: 1000,
      tokens_in: 100,
      tokens_out: 50,
      findings_count: 0,
      grounding: '0/0 passed',
      ran_at: '2026-09-25T00:00:00.000Z',
      score: 100,
      blockers: 0,
    };
    expect(RunSummary.parse({ ...summary, cost_usd: null }).cost_usd).toBeNull();
    expect(RunSummary.safeParse({ ...summary, cost_usd: -0.01 }).success).toBe(false);
  });
});

describe('PR Brief transport contracts', () => {
  const brief = {
    summary: 'Add validation to the brief endpoint.',
    review_focus: [
      { file: 'server/src/modules/brief/routes.ts', line: 42, reason: 'Validate cache freshness.' },
      { file: 'client/src/lib/api.ts', line: 18, reason: 'Render the returned state.' },
    ],
    head_sha: '4d2a7f8',
    intent: { intent: 'Validate brief transport.', in_scope: ['contracts'], out_of_scope: [] },
    blast: { changed_symbols: [], downstream: [], summary: 'No downstream impact.' },
    risks: { risks: [] },
    history: { history: [] },
  };

  it('accepts a brief with ordered repository-relative review focus', () => {
    const parsed = Brief.parse(brief);
    expect(parsed.summary).toBe(brief.summary);
    expect(parsed.review_focus.map((focus) => focus.file)).toEqual([
      'server/src/modules/brief/routes.ts',
      'client/src/lib/api.ts',
    ]);
  });

  it('makes the composed PrBrief carry generated summary, focus, and revision fields', () => {
    expect(PrBrief.parse(brief)).toMatchObject({
      summary: brief.summary,
      review_focus: brief.review_focus,
      head_sha: brief.head_sha,
    });
    expect(PrBrief.safeParse({ ...brief, summary: undefined }).success).toBe(false);
  });

  it('parses legacy stored cache data without treating it as a current brief', () => {
    const legacyBrief = {
      intent: brief.intent,
      blast: brief.blast,
      risks: brief.risks,
      history: brief.history,
      legacy_provider_metadata: 'ignored by the former non-strict parser',
    };

    const parsedLegacyBrief = LegacyPrBrief.parse(legacyBrief);
    expect(parsedLegacyBrief).toMatchObject({
      intent: brief.intent,
      blast: brief.blast,
      risks: brief.risks,
      history: brief.history,
    });
    expect(parsedLegacyBrief).not.toHaveProperty('legacy_provider_metadata');
    expect(StoredPrBrief.parse(legacyBrief)).toMatchObject({
      intent: brief.intent,
      blast: brief.blast,
      risks: brief.risks,
      history: brief.history,
    });
    expect(PrBrief.safeParse(legacyBrief).success).toBe(false);
    expect(BriefCacheResponse.safeParse({ cache_state: 'current', brief: legacyBrief }).success).toBe(false);
  });

  it.each([undefined, ''])('rejects a missing or empty brief head SHA', (head_sha) => {
    expect(Brief.safeParse({ ...brief, head_sha }).success).toBe(false);
  });

  it('accepts grounded risks and rejects invalid risk fields', () => {
    const withRisk = {
      ...brief,
      risks: {
        risks: [
          {
            kind: 'security',
            title: 'Validate authorization boundary',
            explanation: 'The route changes access control.',
            severity: 'high',
            file_refs: ['server/src/modules/brief/routes.ts'],
          },
        ],
      },
    };

    expect(Brief.parse(withRisk).risks.risks).toHaveLength(1);
    expect(
      Brief.safeParse({
        ...withRisk,
        risks: { risks: [{ ...withRisk.risks.risks[0], severity: 'critical' }] },
      }).success,
    ).toBe(false);
    expect(
      Brief.safeParse({
        ...withRisk,
        risks: { risks: [{ ...withRisk.risks.risks[0], file_refs: ['\\windows\\system32'] }] },
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...brief, summary: '' },
    { ...brief, review_focus: [{ file: 'server/src/brief.ts', line: 0, reason: 'bad line' }] },
    { ...brief, review_focus: [{ file: '/etc/passwd', line: 1, reason: 'absolute path' }] },
    { ...brief, review_focus: [{ file: '\\windows\\system32', line: 1, reason: 'backslash absolute path' }] },
    { ...brief, review_focus: [{ file: 'server/../.env', line: 1, reason: 'traversal' }] },
    { ...brief, review_focus: [{ file: 'C:\\secret.txt', line: 1, reason: 'windows absolute path' }] },
    { ...brief, review_focus: [{ file: 'C:outside.txt', line: 1, reason: 'drive-prefixed path' }] },
    {
      ...brief,
      risks: {
        risks: [{ kind: 'security', title: 'Unsafe reference', explanation: 'outside checkout', severity: 'high', file_refs: ['../.env'] }],
      },
    },
  ])('rejects invalid brief input %#', (value) => {
    expect(Brief.safeParse(value).success).toBe(false);
  });

  it('models missing, current, and stale cache states without a brief on missing', () => {
    expect(BriefCacheResponse.parse({ cache_state: 'missing' })).toEqual({ cache_state: 'missing' });
    expect(BriefCacheResponse.parse({ cache_state: 'current', brief })).toMatchObject({ cache_state: 'current', brief });
    expect(BriefCacheResponse.parse({ cache_state: 'stale', brief })).toMatchObject({ cache_state: 'stale', brief });
    expect(BriefCacheResponse.safeParse({ cache_state: 'missing', brief }).success).toBe(false);
  });

  it('transports trace-safe source status only', () => {
    expect(
      BriefSourceStatus.parse({
        source_kind: 'repository_file',
        path: 'docs/specs/brief.md',
        provenance: 'tracked_checkout',
        status: 'available',
        reason_code: null,
        estimated_tokens: 250,
      }),
    ).toMatchObject({ source_kind: 'repository_file', path: 'docs/specs/brief.md', status: 'available' });
    expect(
      BriefSourceStatus.parse({
        source_kind: 'repository_file',
        path: 'docs/specs/brief.md',
        provenance: 'tracked_checkout',
        status: 'omitted',
        reason_code: 'token_budget',
        estimated_tokens: 250,
      }).status,
    ).toBe('omitted');
    expect(
      BriefSourceStatus.parse({
        source_kind: 'smart_diff',
        path: null,
        provenance: 'pull_request',
        status: 'unavailable',
        reason_code: 'repo_intel_unavailable',
        estimated_tokens: 0,
      }),
    ).toMatchObject({ source_kind: 'smart_diff', status: 'unavailable' });
    expect(
      BriefSourceStatus.parse({
        source_kind: 'intent',
        path: null,
        provenance: 'pull_request',
        status: 'unavailable',
        reason_code: 'intent_not_derived',
        estimated_tokens: 0,
      }),
    ).toMatchObject({ source_kind: 'intent', status: 'unavailable' });
    expect(
      BriefSourceStatus.parse({
        source_kind: 'blast_radius',
        path: null,
        provenance: 'pull_request',
        status: 'unavailable',
        reason_code: 'blast_not_derived',
        estimated_tokens: 0,
      }),
    ).toMatchObject({ source_kind: 'blast_radius', status: 'unavailable' });
    expect(
      BriefSourceStatus.safeParse({
        source_kind: 'repository_file',
        path: '../secrets.env',
        provenance: 'tracked_checkout',
        status: 'unavailable',
        reason_code: null,
        estimated_tokens: 250,
      }).success,
    ).toBe(false);
    expect(
      BriefSourceStatus.safeParse({
        source_kind: 'repository_file',
        path: 'docs/specs/brief.md',
        provenance: 'tracked_checkout',
        status: 'rejected',
        reason_code: null,
        estimated_tokens: 250,
        content: 'sensitive source text',
      }).success,
    ).toBe(false);
  });

  it('uses a stable in-progress error code in the generate response', () => {
    expect(BriefGenerationInProgressError.parse({ code: 'brief_generation_in_progress' })).toEqual({
      code: 'brief_generation_in_progress',
    });
    expect(BriefGenerationInProgressError.safeParse({ code: 'other' }).success).toBe(false);
    expect(
      BriefGenerateResponse.parse({
        cache: { cache_state: 'current', brief },
        sources: [
          {
            source_kind: 'pr_description',
            path: null,
            provenance: 'pull_request',
            status: 'available',
            reason_code: null,
            estimated_tokens: 38,
          },
        ],
      }),
    ).toMatchObject({ cache: { cache_state: 'current' } });
  });
});

describe('platform DTOs', () => {
  it('Settings defaults + passthrough', () => {
    const s = Settings.parse({ extra_key: 'x' });
    expect(s.theme).toBe('dark');
    expect((s as Record<string, unknown>).extra_key).toBe('x');
  });

  it('Repo + PrDetail', () => {
    expect(() =>
      Repo.parse({
        id: 'r1',
        workspace_id: 'w1',
        owner: 'acme',
        name: 'payments-api',
        full_name: 'acme/payments-api',
        default_branch: 'main',
        clone_path: null,
        last_polled_at: null,
        created_by: null,
      }),
    ).not.toThrow();
    expect(() =>
      PrDetail.parse({
        number: 482,
        title: 't',
        author: 'a',
        branch: 'b',
        base: 'main',
        head_sha: 'sha',
        additions: 1,
        deletions: 0,
        files_count: 1,
        status: 'open',
        files: [],
        commits: [],
      }),
    ).not.toThrow();
  });
});
