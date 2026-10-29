import { ZodError } from 'zod';
import { generateOnboarding } from '@devdigest/reviewer-core';
import { buildOnboardingSkeleton } from '../domain/skeleton.js';
import { filterOnboardingOutput, safeOnboardingFact } from '../domain/filter-output.js';
import type { AttemptOwner, AttemptUsage, GenerateTourPorts } from './ports.js';
import { OnboardingTour, type OnboardingTourSections } from '../../../vendor/shared/contracts/onboarding-tour.js';

const LEASE_MS = 270_000;
const TIMEOUT_MS = 120_000;
function safeProviderReason(error: unknown): string {
  if (error instanceof Error) {
    if (/^(?:OpenRouter|OpenAI|Anthropic) structured output failed schema validation/.test(error.message)) return 'invalid_response';
    if (/^OpenRouter returned no choices for OnboardingTour/.test(error.message)) return 'provider_no_response';
    if (error.name === 'APIConnectionTimeoutError') return 'timeout';
    if (error.name === 'APIConnectionError') return 'provider_connection_failed';
    if (error.name === 'TypeError') return 'provider_internal_error';
    if (error.name === 'SyntaxError') return 'invalid_response';
  }
  const obj = typeof error === 'object' && error !== null ? error as { status?: unknown; statusCode?: unknown; code?: unknown } : {};
  if (obj.code === 'ECONNREFUSED' || obj.code === 'ECONNRESET' || obj.code === 'ENOTFOUND' || obj.code === 'ETIMEDOUT') return 'provider_connection_failed';
  const status = obj.status ?? obj.statusCode;
  if (status === 400 || status === 422) return 'provider_request_rejected';
  if (status === 402) return 'provider_billing_required';
  if (status === 401 || status === 403) return 'provider_auth_failed';
  if (status === 429) return 'provider_rate_limited';
  return 'provider_failed';
}
/** Only fixed labels and a numeric status leave this boundary; never log a provider payload. */
function safeDiagnostic(error: unknown) {
  const obj = typeof error === 'object' && error !== null ? error as { name?: unknown; status?: unknown; statusCode?: unknown; message?: unknown } : {};
  const names = ['Error', 'TypeError', 'SyntaxError', 'ZodError', 'AppError', 'APIError', 'APIConnectionError', 'APIConnectionTimeoutError'];
  const kind = typeof obj.name === 'string' && names.includes(obj.name) ? obj.name : 'other';
  const value = obj.status ?? obj.statusCode;
  const status = typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
  const message = typeof obj.message === 'string' ? obj.message.toLowerCase() : '';
  const hints = ['schema', 'structured', 'budget', 'connection', 'timeout', 'model', 'token', 'quota', 'auth', 'choices'].filter((word) => message.includes(word));
  return { kind, status, hints };
}
export class GenerateTour {
  private readonly controllers = new Set<AbortController>();
  private readonly tasks = new Set<Promise<void>>();
  constructor(private readonly ports: GenerateTourPorts) {}
  cancelAll() { for (const controller of this.controllers) controller.abort(); }
  async shutdown() { this.cancelAll(); await Promise.allSettled(this.tasks); }
  async start(workspaceId: string, repoId: string) {
    const current = await this.ports.repository.get(workspaceId, repoId);
    if (!current) return null;
    const owner = await this.ports.repository.admit(workspaceId, repoId, LEASE_MS);
    if (!owner) {
      const latest = await this.ports.repository.get(workspaceId, repoId);
      const attempt = latest?.attempt as { id?: unknown; status?: unknown } | null | undefined;
      return attempt && typeof attempt.id === 'string' && attempt.status === 'pending' ? { id: attempt.id, status: 'pending' as const } : null;
    }
    const controller = new AbortController();
    this.controllers.add(controller);
    const task = this.execute(workspaceId, repoId, owner, controller.signal).catch(() => undefined).finally(() => { this.controllers.delete(controller); this.tasks.delete(task); });
    this.tasks.add(task);
    return { id: owner.id, status: 'pending' as const };
  }
  async execute(workspaceId: string, repoId: string, owner: AttemptOwner, signal?: AbortSignal) {
    const previous = await this.ports.repository.get(workspaceId, repoId);
    if (!previous) return;
    const hasPreviousTour = OnboardingTour.safeParse(previous.tour?.json).success;
    let usage: AttemptUsage = { call_count: 0, input_tokens: null, output_tokens: null, cost_usd: null };
    let reason: string | null = null;
    let diagnostic: ReturnType<typeof safeDiagnostic> | undefined;
    let collected: Awaited<ReturnType<GenerateTourPorts['collect']>> | null = null;
    let sections: OnboardingTourSections | null = null;
    try {
      if (signal?.aborted) throw new Error('cancelled');
      collected = await boundedGeneration(this.ports.collect(workspaceId, repoId), signal);
      if (signal?.aborted) throw new Error('cancelled');
      const facts = collected.facts.filter(safeOnboardingFact);
      sections = buildOnboardingSkeleton(facts, collected.files);
      if (!collected.sourceAvailable || !collected.sourceRevision) reason = 'source_unavailable';
      else if (collected.indexStatus !== 'full' || !collected.ranked || facts.length === 0) reason = 'index_unavailable';
      else {
        const provider = await this.ports.resolveProvider(workspaceId);
        if (!provider) reason = 'provider_unavailable';
        else {
          usage = { ...usage, call_count: 1 };
          const generated = await boundedGeneration(generateOnboarding({ ...provider, facts, timeoutMs: TIMEOUT_MS }), signal);
          usage = { call_count: 1, ...generated.usage };
          const grounded = filterOnboardingOutput(generated.output, facts);
          sections = sections.map((fallback, i) => {
            const model = grounded[i];
            const items = fallback.id === 'reading_path' || fallback.id === 'critical_paths' || fallback.id === 'architecture' || fallback.id === 'first_tasks' ? fallback.items : model?.items.length ? model.items : fallback.items;
            const documented = fallback.id === 'architecture' ? facts.filter((fact) => fact.kind === 'documentation').slice(0, 3).map((fact) => ({ text: fact.value, fact_ids: [fact.id] })) : [];
            const narrative = fallback.id === 'reading_path' || fallback.id === 'first_tasks' ? [] : [...documented, ...(model?.narrative ?? []).filter((sentence) => !documented.some((item) => item.text === sentence.text))];
            return { ...fallback, items, narrative, unavailable_reason: items.length || narrative.length ? null : fallback.unavailable_reason };
          }) as OnboardingTourSections;
        }
      }
    } catch (error) {
      if (usage.call_count) diagnostic = safeDiagnostic(error);
      reason = signal?.aborted ? 'cancelled' : error instanceof Error && error.message === 'timeout' ? 'timeout' : error instanceof ZodError ? 'invalid_response' : usage.call_count ? safeProviderReason(error) : 'source_unavailable';
    }
    const status = reason === 'cancelled' ? 'cancelled' : reason ? hasPreviousTour ? 'failed' : 'partial' : collected?.limitations.length ? 'partial' : 'generated';
    if (!sections || !collected) {
      sections = buildOnboardingSkeleton([]);
      reason = reason ?? 'source_unavailable';
    }
    const result = status === 'failed' || status === 'cancelled' ? null : {
      repo_id: repoId, sections, status, source_revision: collected?.sourceRevision ?? null,
      index_revision: collected?.sourceRevision ?? null, index_state: collected?.indexStatus === 'full' ? 'ready' : collected?.indexStatus === 'partial' ? 'incomplete' : collected?.indexStatus === 'failed' || collected?.indexStatus === 'degraded' ? 'degraded' : 'unavailable',
      freshness: 'unknown', generated_at: new Date().toISOString(), limitations: collected?.limitations ?? ['Source unavailable'],
      counts: { indexed_files: collected?.indexedCount ?? null, selected_files: collected?.files.length ?? 0, omitted_files: collected?.omittedFiles ?? null, estimated_tokens: collected?.estimatedTokens ?? 0 }, usage,
    };
    try {
      const saved = await this.ports.repository.finish(workspaceId, repoId, owner.id, owner.token, status, result, reason, usage);
      this.ports.log({ outcome: saved ? status : 'stale', reason, usage, ...(diagnostic ? { diagnostic } : {}) });
    } catch (error) {
      this.ports.log({ outcome: 'failed', reason: 'storage_failed', usage });
      throw error;
    }
  }
}

async function boundedGeneration<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new Error('cancelled');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
    onAbort = () => reject(new Error('cancelled'));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([promise, timeout]); }
  finally { if (timer) clearTimeout(timer); if (onAbort) signal?.removeEventListener('abort', onAbort); }
}
