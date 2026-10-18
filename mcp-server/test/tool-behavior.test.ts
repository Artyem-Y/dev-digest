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
    getFindings: vi.fn().mockResolvedValue({
      run_id: 'run-1', status: 'done', error: null, verdict: 'approve', summary: 'Looks good.', score: 95,
      severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false, findings: [],
    }),
    getConventions: vi.fn().mockResolvedValue([
      { id: 'c-1', status: 'accepted', rule: 'Use strict types.', category: 'style', evidence_path: 'src/a.ts', evidence_line: 1, confidence: 0.9 },
    ]),
    ...overrides,
  };
}

function tool(definitions: ReturnType<typeof createToolDefinitions>, name: string) {
  return definitions.find((definition) => definition.name === name)!;
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

  it('lists bounded safe agent summaries', async () => {
    const api = client({ listAgents: vi.fn().mockResolvedValue(Array.from({ length: 51 }, () => agent)) });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_list_agents').handler({});

    expect(result.structuredContent?.agents).toHaveLength(50);
  });

  it('runs exactly one enabled agent and returns persisted terminal findings', async () => {
    const api = client();
    const result = await tool(createToolDefinitions(api as never), 'devdigest_run_agent_on_pr').handler({
      repository: 'acme/payments', pr_number: 3, agent_id: agent.id,
    });

    expect(api.runReview).toHaveBeenCalledWith('pull-1', agent.id);
    expect(api.getFindings).toHaveBeenCalledWith('run-1', { timeoutMs: 120_000 });
    expect(result.structuredContent).toMatchObject({
      run_id: 'run-1', status: 'done', verdict: 'approve',
      severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false,
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

  it('returns the same run id when the 120-second wait expires', async () => {
    const api = client({
      getFindings: vi.fn().mockResolvedValue({
        run_id: 'run-1', status: 'running', error: null, verdict: null, summary: null, score: null,
        severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false, findings: [],
      }),
    });
    const result = await tool(createToolDefinitions(api as never, { maxWaitMs: 0 }), 'devdigest_run_agent_on_pr').handler({
      repository: 'acme/payments', pr_number: 3, agent_id: agent.id,
    });

    expect(api.runReview).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toEqual({ status: 'running', run_id: 'run-1' });
  });

  it('returns an actionable error for a failed persisted run', async () => {
    const api = client({
      getFindings: vi.fn().mockResolvedValue({
        run_id: 'run-1', status: 'failed', error: 'Provider unavailable', verdict: null, summary: null, score: null,
        severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false, findings: [],
      }),
    });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_run_agent_on_pr').handler({
      repository: 'acme/payments', pr_number: 3, agent_id: agent.id,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Provider unavailable');
    expect(result.content[0]?.text).toContain('devdigest_get_findings');
  });

  it('gets a persisted result by run id without starting a review', async () => {
    const api = client({
      getFindings: vi.fn().mockResolvedValue({
        run_id: 'run-1', status: 'done', error: null, verdict: 'request_changes', summary: 'Persisted result', score: 10,
        severity_counts: { critical: 3, warning: 2, suggestion: 17 }, findings_truncated: true, findings: [],
      }),
    });
    const result = await tool(createToolDefinitions(api as never), 'devdigest_get_findings').handler({ run_id: '00000000-0000-0000-0000-000000000001' });

    expect(api.getFindings).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001');
    expect(api.runReview).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      status: 'done', severity_counts: { critical: 3, warning: 2, suggestion: 17 }, findings_truncated: true,
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

    expect(result.structuredContent).toEqual({
      repository: 'acme/payments',
      conventions: [{ rule: 'Keep boundaries thin.', category: 'style', evidence_path: 'src/a.ts', evidence_line: 1, confidence: 0.9 }],
    });
  });

  it('returns the blast-radius placeholder without an HTTP call', async () => {
    const api = client();
    const result = await tool(createToolDefinitions(api as never), 'devdigest_get_blast_radius').handler({
      repository: 'acme/payments', pr_number: 3,
    });

    expect(result.structuredContent).toEqual({ status: 'unavailable', reason: 'not_implemented', blast_radius: null });
    expect(api.listRepos).not.toHaveBeenCalled();
  });
});
