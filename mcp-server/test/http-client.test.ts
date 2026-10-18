import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpDevDigestApi } from '../src/http-client.js';

afterEach(() => vi.unstubAllGlobals());

describe('HttpDevDigestApi', () => {
  it('parses only the safe agent summary endpoint response', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { id: '00000000-0000-0000-0000-000000000001', name: 'Security', description: 'Checks', enabled: true, provider: 'openai', model: 'gpt', version: 1 },
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await expect(new HttpDevDigestApi('http://127.0.0.1:3999/').listAgents()).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3999/agents/summary', expect.objectContaining({
      headers: expect.objectContaining({ accept: 'application/json' }),
    }));
  });

  it('posts one agent id when starting a review', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runs: [{ run_id: 'run-1', agent_id: 'agent-1', agent_name: 'Security' }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await new HttpDevDigestApi('http://127.0.0.1:3999').runReview('pull-1', 'agent-1');

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3999/pulls/pull-1/review', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ agentId: 'agent-1' }),
    }));
  });

  it('gets and validates the Blast Radius map for one pull request', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      changed_symbols: [], downstream: [], summary: '0 symbols · 0 callers · 0 endpoints · 0 cron/jobs', degraded: false, reason: null,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await expect(new HttpDevDigestApi('http://127.0.0.1:3999').getBlastRadius('pull-1')).resolves.toMatchObject({ degraded: false });
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3999/pulls/pull-1/blast', expect.objectContaining({
      headers: expect.objectContaining({ accept: 'application/json' }),
    }));
  });

  it('turns an unreachable local API into a startup action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    await expect(new HttpDevDigestApi('http://127.0.0.1:3999').listRepos()).rejects.toThrow('./scripts/dev.sh');
  });

  it.each(['https://api.devdigest.example', 'http://192.168.1.20:3001', 'http://[::2]:3001'])(
    'rejects a non-local DEVDIGEST_API_URL (%s)',
    (baseUrl) => {
      expect(() => new HttpDevDigestApi(baseUrl)).toThrow('DEVDIGEST_API_URL must use an http:// loopback or localhost URL');
    },
  );

  it('rejects local URLs that include userinfo', () => {
    expect(() => new HttpDevDigestApi('http://token:secret@127.0.0.1:3001'))
      .toThrow('DEVDIGEST_API_URL must not include username or password');
  });

  it('does not expose fetch errors in connection diagnostics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused for token=secret')));

    await expect(new HttpDevDigestApi('http://127.0.0.1:3999').listRepos())
      .rejects.toThrow('Cannot reach DevDigest at http://127.0.0.1:3999. Start it with ./scripts/dev.sh, then retry.');
    await expect(new HttpDevDigestApi('http://127.0.0.1:3999').listRepos())
      .rejects.not.toThrow('token=secret');
  });

  it('uses the caller deadline instead of the default request timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      run_id: 'run-1', status: 'running', error: null, verdict: null, summary: null, score: null,
      severity_counts: { critical: 0, warning: 0, suggestion: 0 }, findings_truncated: false, findings: [],
    }), { status: 200 })));

    await new HttpDevDigestApi('http://localhost:3999').getFindings('run-1', { timeoutMs: 321 });

    expect(timeout).toHaveBeenCalledWith(321);
  });

  it('preserves all-findings severity counts and truncation from the safe run DTO', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      run_id: 'run-1', status: 'done', error: null, verdict: 'request_changes', summary: 'Persisted result', score: 10,
      severity_counts: { critical: 3, warning: 2, suggestion: 17 }, findings_truncated: true, findings: [],
    }), { status: 200 })));

    await expect(new HttpDevDigestApi('http://127.0.0.1:3999').getFindings('run-1')).resolves.toMatchObject({
      severity_counts: { critical: 3, warning: 2, suggestion: 17 },
      findings_truncated: true,
    });
  });
});
