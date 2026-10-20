import { z } from 'zod';

const AgentSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  provider: z.string(),
  model: z.string(),
  version: z.number().int(),
});
const Repo = z.object({ id: z.string(), owner: z.string(), name: z.string(), full_name: z.string() }).passthrough();
const Pull = z.object({ id: z.string(), number: z.number().int(), title: z.string() }).passthrough();
const Finding = z.object({
  id: z.string(), severity: z.string(), category: z.string(), title: z.string(), file: z.string(),
  start_line: z.number().int(), end_line: z.number().int(), rationale: z.string(), suggestion: z.string().nullable(),
  confidence: z.number(), kind: z.string(),
});
const RunFindings = z.object({
  run_id: z.string(), status: z.enum(['running', 'done', 'failed', 'cancelled']), error: z.string().nullable(),
  verdict: z.enum(['request_changes', 'approve', 'comment']).nullable(), summary: z.string().nullable(),
  score: z.number().int().nullable(),
  severity_counts: z.object({ critical: z.number().int().nonnegative(), warning: z.number().int().nonnegative(), suggestion: z.number().int().nonnegative() }),
  findings_truncated: z.boolean(), findings: z.array(Finding),
});
const Review = z.object({
  id: z.string(), pr_id: z.string(), agent_id: z.string().nullable(), run_id: z.string().nullable(),
  agent_name: z.string().nullable().optional(), kind: z.enum(['summary', 'review']),
  verdict: z.string().nullable(), summary: z.string().nullable(), score: z.number().nullable(),
  model: z.string().nullable(), created_at: z.string(), findings: z.array(Finding),
}).passthrough();
const Convention = z.object({
  status: z.string(), rule: z.string(), category: z.string(), evidence_path: z.string(), evidence_line: z.number().int(), confidence: z.number(),
}).passthrough();
const BlastRadius = z.object({
  changed_symbols: z.array(z.object({ name: z.string(), file: z.string(), kind: z.string() })),
  changedSymbols: z.array(z.object({ name: z.string(), file: z.string(), kind: z.string() })),
  callers: z.array(z.object({ file: z.string(), symbol: z.string(), viaSymbol: z.string(), line: z.number().int(), rank: z.number() })),
  downstream: z.array(z.object({
    symbol: z.string(),
    callers: z.array(z.object({ name: z.string(), file: z.string(), line: z.number().int() })),
    endpoints_affected: z.array(z.string()),
    crons_affected: z.array(z.string()),
  })),
  summary: z.string(),
  degraded: z.boolean(),
  reason: z.enum(['flag_off', 'index_failed', 'index_partial', 'repo_too_large', 'no_data']).nullable(),
});
const ReviewStart = z.object({ runs: z.array(z.object({ run_id: z.string(), agent_id: z.string(), agent_name: z.string() })) });

export type AgentSummary = z.infer<typeof AgentSummary>;
export type Repo = z.infer<typeof Repo>;
export type Pull = z.infer<typeof Pull>;
export type RunFindings = z.infer<typeof RunFindings>;
export type Review = z.infer<typeof Review>;
export type Convention = z.infer<typeof Convention>;
export type BlastRadius = z.infer<typeof BlastRadius>;

export type ApiRequestOptions = {
  timeoutMs?: number;
};

export interface DevDigestApi {
  listAgents(): Promise<AgentSummary[]>;
  listRepos(): Promise<Repo[]>;
  listPulls(repoId: string): Promise<Pull[]>;
  runReview(pullId: string, agentId: string): Promise<z.infer<typeof ReviewStart>>;
  getRunFindings(runId: string, options?: ApiRequestOptions): Promise<RunFindings>;
  getPullReviews(pullId: string, options?: { latestPerAgent?: boolean }): Promise<Review[]>;
  getConventions(repoId: string): Promise<Convention[]>;
  getBlastRadius(pullId: string): Promise<BlastRadius>;
}

export class DevDigestApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'DevDigestApiError';
  }
}

export class DevDigestApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DevDigestApiConfigurationError';
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
// GitHub history reads allow four 30-second attempts with exponential backoff.
const BLAST_RADIUS_REQUEST_TIMEOUT_MS = 130_000;

function localBaseUrl(value: string): { baseUrl: string; diagnosticOrigin: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DevDigestApiConfigurationError(
      'DEVDIGEST_API_URL must use an http:// loopback or localhost URL, for example http://127.0.0.1:3001.',
    );
  }
  if (url.username || url.password) {
    throw new DevDigestApiConfigurationError(
      'DEVDIGEST_API_URL must not include username or password. Use a local DevDigest URL such as http://127.0.0.1:3001.',
    );
  }
  const isLoopback = url.hostname === 'localhost'
    || url.hostname === '::1'
    || url.hostname === '[::1]'
    || /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (url.protocol !== 'http:' || !isLoopback) {
    throw new DevDigestApiConfigurationError(
      'DEVDIGEST_API_URL must use an http:// loopback or localhost URL, for example http://127.0.0.1:3001. Remove the remote override and retry.',
    );
  }
  return { baseUrl: url.href.replace(/\/$/, ''), diagnosticOrigin: url.origin };
}

export class HttpDevDigestApi implements DevDigestApi {
  private readonly baseUrl: string;
  private readonly diagnosticOrigin: string;

  constructor(baseUrl = process.env.DEVDIGEST_API_URL ?? 'http://127.0.0.1:3001') {
    const localUrl = localBaseUrl(baseUrl);
    this.baseUrl = localUrl.baseUrl;
    this.diagnosticOrigin = localUrl.diagnosticOrigin;
  }

  listAgents() { return this.request('/agents/summary', AgentSummary.array()); }
  listRepos() { return this.request('/repos', Repo.array()); }
  listPulls(repoId: string) { return this.request(`/repos/${encodeURIComponent(repoId)}/pulls`, Pull.array()); }
  getRunFindings(runId: string, options: ApiRequestOptions = {}) {
    return this.request(`/runs/${encodeURIComponent(runId)}/findings`, RunFindings, {}, options);
  }
  getPullReviews(pullId: string, options: { latestPerAgent?: boolean } = {}) {
    const query = options.latestPerAgent ? '?latest_per_agent=true' : '';
    return this.request(`/pulls/${encodeURIComponent(pullId)}/reviews${query}`, Review.array());
  }
  getConventions(repoId: string) { return this.request(`/repos/${encodeURIComponent(repoId)}/conventions`, Convention.array()); }
  getBlastRadius(pullId: string) {
    return this.request(
      `/pulls/${encodeURIComponent(pullId)}/blast`,
      BlastRadius,
      {},
      { timeoutMs: BLAST_RADIUS_REQUEST_TIMEOUT_MS },
      BLAST_RADIUS_REQUEST_TIMEOUT_MS,
    );
  }
  runReview(pullId: string, agentId: string) {
    return this.request(`/pulls/${encodeURIComponent(pullId)}/review`, ReviewStart, {
      method: 'POST', body: JSON.stringify({ agentId }),
    });
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
    options: ApiRequestOptions = {},
    maximumTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    const timeoutMs = Math.min(options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, maximumTimeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new DevDigestApiError(`Cannot reach DevDigest at ${this.diagnosticOrigin}. Start it with ./scripts/dev.sh, then retry.`);
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'error' in body
        ? String((body as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`;
      throw new DevDigestApiError(message, response.status);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new DevDigestApiError(`DevDigest returned an unexpected response for ${path}.`);
    return parsed.data;
  }
}
