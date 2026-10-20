import { describe, expect, it, vi } from 'vitest';
import { createToolDefinitions } from '../src/tools/definitions.js';

const repo = { id: 'repo-1', owner: 'acme', name: 'payments', full_name: 'acme/payments' };
const pull = { id: 'pull-1', number: 3, title: 'Secure login' };
const agent = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Security Reviewer',
  description: 'Security checks',
  enabled: true,
  provider: 'openai',
  model: 'gpt-4.1-mini',
  version: 1,
};

function client(overrides: Record<string, unknown> = {}) {
  return {
    listAgents: vi.fn().mockResolvedValue([agent]),
    listRepos: vi.fn().mockResolvedValue([repo]),
    listPulls: vi.fn().mockResolvedValue([pull]),
    runReview: vi.fn().mockResolvedValue({ runs: [{ run_id: 'run-1', agent_id: agent.id, agent_name: agent.name }] }),
    getRunFindings: vi.fn().mockResolvedValue({
      run_id: 'run-1', status: 'done', error: null, verdict: 'approve', summary: 'Looks good.', score: 95,
      severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false, findings: [],
    }),
    getPullReviews: vi.fn().mockResolvedValue([
      {
        id: 'review-1', pr_id: 'pull-1', agent_id: agent.id, run_id: 'run-1', agent_name: agent.name,
        kind: 'review', verdict: 'approve', summary: 'Looks good.', score: 95, model: 'gpt-4.1-mini',
        created_at: '2026-10-19T12:00:00.000Z', findings: [],
      },
    ]),
    getConventions: vi.fn().mockResolvedValue([
      { id: 'c-1', status: 'accepted', rule: 'Use strict types.', category: 'style', evidence_path: 'src/a.ts', evidence_line: 1, confidence: 0.9 },
    ]),
    getBlastRadius: vi.fn().mockResolvedValue({
      changed_symbols: [], changedSymbols: [], callers: [], downstream: [], summary: '0 symbols · 0 callers · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
    }),
    ...overrides,
  };
}

function tool(definitions: ReturnType<typeof createToolDefinitions>, name: string) {
  return definitions.find((definition) => definition.name === name)!;
}

function json(result: Awaited<ReturnType<ReturnType<typeof createToolDefinitions>[number]['handler']>>) {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

describe('DevDigest MCP tool behavior', () => {
  it('marks only the four read tools as read-only', () => {
    const definitions = createToolDefinitions(client() as never);
    for (const name of ['devdigest_list_agents', 'devdigest_get_findings', 'devdigest_get_conventions', 'devdigest_get_blast_radius']) {
      expect(tool(definitions, name).annotations.readOnlyHint).toBe(true);
    }
    expect(tool(definitions, 'devdigest_run_agent_on_pr').annotations.readOnlyHint).toBe(false);
    expect(tool(definitions, 'devdigest_run_agent_on_pr').annotations).toMatchObject({
      destructiveHint: false, idempotentHint: false, openWorldHint: true,
    });
  });

  it('lists bounded agent summaries without provider or version internals', async () => {
    const api = client({ listAgents: vi.fn().mockResolvedValue(Array.from({ length: 51 }, () => agent)) });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_list_agents').handler({});

    expect(json(result).agents).toHaveLength(50);
    expect(json(result).agents).toEqual([{
      id: agent.id, name: agent.name, description: agent.description, model: agent.model, enabled: agent.enabled,
    }, ...Array.from({ length: 49 }, () => ({
      id: agent.id, name: agent.name, description: agent.description, model: agent.model, enabled: agent.enabled,
    }))]);
  });

  it('runs exactly one enabled agent and returns its persisted terminal findings', async () => {
    const api = client();
    const result = await tool(createToolDefinitions(api as never), 'devdigest_run_agent_on_pr').handler({
      repository: 'acme/payments', pr_number: 3, agent_id: agent.id,
    });

    expect(api.runReview).toHaveBeenCalledWith('pull-1', agent.id);
    expect(api.getRunFindings).toHaveBeenCalledWith('run-1', { timeoutMs: 600_000 });
    expect(json(result)).toMatchObject({ run_id: 'run-1', status: 'done', verdict: 'approve' });
  });

  it('sends MCP progress while a review remains running', async () => {
    const api = client({
      getRunFindings: vi.fn()
        .mockResolvedValueOnce({ run_id: 'run-1', status: 'running', error: null, verdict: null, summary: null, score: null, severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false, findings: [] })
        .mockResolvedValueOnce({ run_id: 'run-1', status: 'done', error: null, verdict: 'approve', summary: 'Looks good.', score: 95, severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false, findings: [] }),
    });
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const result = await tool(createToolDefinitions(api as never, { sleep: vi.fn().mockResolvedValue(undefined) }), 'devdigest_run_agent_on_pr').handler({
      repository: 'acme/payments', pr_number: 3, agent_id: agent.id,
    }, { _meta: { progressToken: 'review-token' }, sendNotification });

    expect(result.isError).not.toBe(true);
    expect(sendNotification).toHaveBeenCalledWith({
      method: 'notifications/progress',
      params: { progressToken: 'review-token', progress: 1, message: 'DevDigest review is still running.' },
    });
  });

  it('does not start a review for an unknown agent and tells the caller what to do', async () => {
    const api = client({ listAgents: vi.fn().mockResolvedValue([]) });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_run_agent_on_pr').handler({
      repository: 'acme/payments', pr_number: 3, agent_id: agent.id,
    });

    expect(api.runReview).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('devdigest_list_agents');
  });

  it('returns an actionable error for a cancelled persisted run', async () => {
    const api = client({
      getRunFindings: vi.fn().mockResolvedValue({
        run_id: 'run-1', status: 'cancelled', error: 'Run was cancelled', verdict: null, summary: null, score: null,
        severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false, findings: [],
      }),
    });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_run_agent_on_pr').handler({
      repository: 'acme/payments', pr_number: 3, agent_id: agent.id,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Run was cancelled');
  });

  it('returns an actionable error when the persisted review fails', async () => {
    const api = client({
      getRunFindings: vi.fn().mockResolvedValue({
        run_id: 'run-1', status: 'failed', error: 'Provider unavailable', verdict: null, summary: null, score: null,
        severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false, findings: [],
      }),
    });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_run_agent_on_pr').handler({
      repository: 'acme/payments', pr_number: 3, agent_id: agent.id,
    });

    expect(result.isError).toBe(true);
    expect(api.getRunFindings).toHaveBeenCalledWith('run-1', { timeoutMs: 600_000 });
    expect(result.content[0]?.text).toContain('Provider unavailable');
  });

  it('finds the latest persisted review for each agent by PR locator without starting a review', async () => {
    const api = client({
      getPullReviews: vi.fn().mockResolvedValue([
        { id: 'old-review', pr_id: 'pull-1', agent_id: agent.id, run_id: 'old-run', agent_name: agent.name, kind: 'review', verdict: 'comment', summary: 'Old', score: 50, model: 'gpt', created_at: '2026-10-18T12:00:00.000Z', findings: [] },
        {
          id: 'new-review', pr_id: 'pull-1', agent_id: agent.id, run_id: 'new-run', agent_name: agent.name,
          kind: 'review', verdict: 'request_changes', summary: 'Persisted result', score: 10, model: 'gpt', created_at: '2026-10-19T12:00:00.000Z',
          findings: [{ id: 'finding-1', severity: 'warning', category: 'security', title: 'Validate input', file: 'src/a.ts', start_line: 3, end_line: 3, rationale: 'Untrusted value.', suggestion: null, confidence: 0.9, kind: 'issue' }],
        },
      ]),
    });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_get_findings').handler({ pr_id: '#3', repo: 'acme/payments' });

    expect(api.getPullReviews).toHaveBeenCalledWith('pull-1');
    expect(api.runReview).not.toHaveBeenCalled();
    expect(json(result)).toMatchObject({
      pr_id: 'pull-1', repository: 'acme/payments', total_findings: 1,
      reviews: [{ agent_id: agent.id, run_id: 'new-run', findings: [{ id: 'finding-1' }] }],
    });
  });

  it('searches configured repositories when repository is omitted for a review run', async () => {
    const api = client();
    const result = await tool(createToolDefinitions(api as never), 'devdigest_run_agent_on_pr').handler({
      pr_number: 3, agent_id: agent.id,
    });

    expect(result.isError).not.toBe(true);
    expect(api.listRepos).toHaveBeenCalledOnce();
    expect(api.runReview).toHaveBeenCalledWith('pull-1', agent.id);
  });

  it('returns all saved reviews when all_runs is requested', async () => {
    const api = client({
      getPullReviews: vi.fn().mockResolvedValue([
        { id: 'old-review', pr_id: 'pull-1', agent_id: agent.id, run_id: 'old-run', agent_name: agent.name, kind: 'review', verdict: 'comment', summary: 'Old', score: 50, model: 'gpt', created_at: '2026-10-18T12:00:00.000Z', findings: [] },
        { id: 'new-review', pr_id: 'pull-1', agent_id: agent.id, run_id: 'new-run', agent_name: agent.name, kind: 'review', verdict: 'approve', summary: 'New', score: 90, model: 'gpt', created_at: '2026-10-19T12:00:00.000Z', findings: [] },
      ]),
    });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_get_findings').handler({ pr_id: 'Secure login', all_runs: true });

    expect(json(result)).toMatchObject({
      total_findings: 0, reviews: [{ run_id: 'new-run' }, { run_id: 'old-run' }],
    });
  });

  it('returns only accepted conventions and never invokes extraction', async () => {
    const api = client({
      getConventions: vi.fn().mockResolvedValue([
        { id: 'accepted', status: 'accepted', rule: 'Keep boundaries thin.', category: 'style', evidence_path: 'src/a.ts', evidence_line: 1, confidence: 0.9 },
        { id: 'pending', status: 'pending', rule: 'Ignore me.', category: 'style', evidence_path: 'src/b.ts', evidence_line: 1, confidence: 0.5 },
      ]),
    });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_get_conventions').handler({ repository: 'acme/payments' });

    expect(json(result)).toEqual({
      repository: 'acme/payments',
      conventions: [{ rule: 'Keep boundaries thin.', category: 'style', evidence_path: 'src/a.ts', evidence_line: 1, confidence: 0.9 }],
    });
  });

  it('returns the API blast map without starting a review or index operation', async () => {
    const api = client();
    const result = await tool(createToolDefinitions(api as never), 'devdigest_get_blast_radius').handler({
      repository: 'acme/payments', pr_number: 3,
    });

    expect(api.getBlastRadius).toHaveBeenCalledWith('pull-1');
    expect(api.runReview).not.toHaveBeenCalled();
    expect(json(result)).toEqual({
      changed_symbols: [], changedSymbols: [], callers: [], downstream: [], summary: '0 symbols · 0 callers · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
    });
  });

  it('searches configured repositories when repository is omitted for Blast Radius', async () => {
    const api = client();
    const result = await tool(createToolDefinitions(api as never), 'devdigest_get_blast_radius').handler({ pr_number: 3 });

    expect(result.isError).not.toBe(true);
    expect(api.listRepos).toHaveBeenCalledOnce();
    expect(api.getBlastRadius).toHaveBeenCalledWith('pull-1');
  });

  it('passes through the raw caller edges shown by repo-intel', async () => {
    const api = client({
      getBlastRadius: vi.fn().mockResolvedValue({
        changed_symbols: [{ name: 'calculateDiscount', file: 'lib/pricing.ts', kind: 'function' }],
        changedSymbols: [{ name: 'calculateDiscount', file: 'lib/pricing.ts', kind: 'function' }],
        callers: [{ file: 'lib/cart.routes.ts', symbol: 'checkout', viaSymbol: 'calculateDiscount', line: 17, rank: 0.0029 }],
        downstream: [{ symbol: 'calculateDiscount', callers: [{ name: 'checkout', file: 'lib/cart.routes.ts', line: 17 }], endpoints_affected: [], crons_affected: [] }],
        summary: '1 symbol · 1 caller · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
      }),
    });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_get_blast_radius').handler({ pr_number: 3 });

    expect(json(result)).toMatchObject({
      changedSymbols: [{ name: 'calculateDiscount' }],
      callers: [{ symbol: 'checkout', viaSymbol: 'calculateDiscount', rank: 0.0029 }],
    });
  });
});
