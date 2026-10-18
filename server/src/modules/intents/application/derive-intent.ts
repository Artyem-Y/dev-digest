import { createHash } from 'node:crypto';
import type { DerivedIntent, Provider } from '@devdigest/shared';
import { derivePullIntent } from '@devdigest/reviewer-core';
import type { FeatureModelResolver, IntentLlmResolver, IntentRepoRef, IntentRepositoryPort, LinkedIssueReader, PublicDocumentFetcher, PublicDocumentResult } from './ports.js';

type SourceKind = 'pr_title' | 'pr_description' | 'github_issue' | 'plan_spec';
type Evidence = DerivedIntent['evidence'][number];
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const planSpecLinks = (body: string) => [...body.matchAll(/(?:plan|spec)\s*(?:\[[^\]]*\]\s*)?\(?\s*(https:\/\/[^\s)\]>]+)/gi)]
  .map((match) => match[1]).filter((value): value is string => Boolean(value)).slice(0, 3);
const INTENT_CACHE_TTL_MS = 5 * 60_000;
/** Revalidate external intent evidence frequently without refetching it per review. */
export const INTENT_SOURCE_CACHE_TTL_MS = 30_000;
const MAX_INTENT_SOURCE_CACHE_ENTRIES = 128;
const MAX_CONCURRENT_DOCUMENT_FETCHES = 2;

/** Cache identity covers the content and availability of every derivation input. */
const cacheFingerprint = (evidence: readonly Evidence[]) => digest(JSON.stringify(evidence.map((item) => ({
  source_kind: item.source_kind,
  reason_code: item.reason_code,
  content_fingerprint: item.content_fingerprint,
}))));
const isFresh = (derivedAt: string) => {
  const timestamp = Date.parse(derivedAt);
  return Number.isFinite(timestamp) && Date.now() - timestamp < INTENT_CACHE_TTL_MS;
};

async function fetchDocuments(
  candidates: string[],
  documents: PublicDocumentFetcher,
): Promise<PublicDocumentResult[]> {
  const results: PublicDocumentResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < candidates.length) {
      const index = next++;
      const candidate = candidates[index]!;
      try {
        results[index] = await documents.fetchPlanOrSpec(candidate);
      } catch {
        results[index] = { ok: false, reasonCode: 'fetch_failed' };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_DOCUMENT_FETCHES, candidates.length) }, worker));
  return results;
}

export interface IntentInput {
  workspaceId: string;
  prId: string;
  title: string;
  body: string | null;
  repo: IntentRepoRef;
  /** A manual user request must bypass a matching persisted derivation. */
  force?: boolean;
}
export type IntentDerivation =
  | { status: 'derived'; intent: DerivedIntent; trace: { confidence: DerivedIntent['confidence']; sourceCount: number; provider: Provider; model: string; persistence: 'created' | 'updated' | 'reused' } }
  | { status: 'unavailable'; reasonCode: string; trace: { sourceCount: number } };

export class DeriveIntentService {
  private readonly sourceCache = new Map<string, {
    expiresAt: number;
    value: Promise<{ issue: Awaited<ReturnType<LinkedIssueReader['findLinkedIssue']>>; planSpecs: PublicDocumentResult[] }>;
  }>();
  private readonly derivations = new Map<string, Promise<IntentDerivation>>();

  constructor(private readonly deps: {
    documents: PublicDocumentFetcher;
    linkedIssues: LinkedIssueReader;
    featureModels: FeatureModelResolver;
    llm: IntentLlmResolver;
    intents: IntentRepositoryPort;
  }) {}

  private evictExpiredSources(now: number): void {
    for (const [key, entry] of this.sourceCache) {
      if (entry.expiresAt <= now) this.sourceCache.delete(key);
    }
  }

  private loadSources(input: IntentInput) {
    const now = Date.now();
    this.evictExpiredSources(now);
    const key = digest(JSON.stringify({ repo: input.repo, body: input.body ?? '' }));
    const cached = this.sourceCache.get(key);
    if (!input.force && cached) return cached.value;

    const value = Promise.all([
      this.deps.linkedIssues.findLinkedIssue(input.repo, input.body).catch(() => undefined),
      fetchDocuments(planSpecLinks(input.body ?? ''), this.deps.documents),
    ]).then(([issue, planSpecs]) => ({ issue, planSpecs }));
    if (!this.sourceCache.has(key) && this.sourceCache.size >= MAX_INTENT_SOURCE_CACHE_ENTRIES) {
      const oldestKey = this.sourceCache.keys().next().value;
      if (oldestKey) this.sourceCache.delete(oldestKey);
    }
    // A manual refresh deliberately bypasses the previous value, then replaces
    // it so the next automatic derivation observes the refreshed evidence.
    this.sourceCache.set(key, { expiresAt: now + INTENT_SOURCE_CACHE_TTL_MS, value });
    return value;
  }

  derive(input: IntentInput): Promise<IntentDerivation> {
    const previous = this.derivations.get(input.prId) ?? Promise.resolve();
    const derivation = previous.catch(() => undefined).then(() => this.deriveOne(input));
    this.derivations.set(input.prId, derivation);
    void derivation.then(
      () => {
        if (this.derivations.get(input.prId) === derivation) this.derivations.delete(input.prId);
      },
      () => {
        if (this.derivations.get(input.prId) === derivation) this.derivations.delete(input.prId);
      },
    );
    return derivation;
  }

  private async deriveOne(input: IntentInput): Promise<IntentDerivation> {
    let resolved: { provider: Provider; model: string };
    let cached: DerivedIntent | undefined;
    try {
      [resolved, cached] = await Promise.all([
        this.deps.featureModels.resolve(input.workspaceId),
        this.deps.intents.getDerivedIntent(input.prId),
      ]);
    } catch {
      return { status: 'unavailable', reasonCode: 'model_unavailable', trace: { sourceCount: 0 } };
    }
    const evidence: Evidence[] = [];
    const sources: { kind: SourceKind; text: string }[] = [];
    const sourceEvidenceIndexes: number[] = [];
    const add = (kind: SourceKind, text: string) => {
      const value = text.trim();
      if (!value) return;
      sources.push({ kind, text: value });
      sourceEvidenceIndexes.push(evidence.length);
      evidence.push({ source_kind: kind, status: 'unused', reason_code: null, content_fingerprint: digest(value) });
    };
    add('pr_title', input.title);
    if (input.body) add('pr_description', input.body);
    const { issue, planSpecs } = await this.loadSources(input);
    if (issue) add('github_issue', `${issue.title}\n${issue.body ?? ''}`);
    for (const result of planSpecs) {
      if (result.ok) add('plan_spec', result.text);
      else evidence.push({ source_kind: 'plan_spec', status: result.reasonCode === 'url_rejected' ? 'rejected' : 'unavailable', reason_code: result.reasonCode, content_fingerprint: null });
    }
    const sourceFingerprint = cacheFingerprint(evidence);
    if (!input.force && cached && cached.source_fingerprint === sourceFingerprint && cached.model_provider === resolved.provider && cached.model === resolved.model && isFresh(cached.derived_at)) {
      return { status: 'derived', intent: cached, trace: { confidence: cached.confidence, sourceCount: cached.evidence.filter((item) => item.status === 'used').length, provider: cached.model_provider, model: cached.model, persistence: 'reused' } };
    }
    if (sources.length === 0) return { status: 'unavailable', reasonCode: 'no_usable_evidence', trace: { sourceCount: 0 } };
    try {
      const classification = await derivePullIntent({ provider: await this.deps.llm.resolve(resolved.provider), model: resolved.model, sources });
      const usedSourceIndexes = new Set(
        classification.classification.source_refs.filter((index) => Number.isInteger(index) && index >= 0 && index < sources.length),
      );
      const titleOnly = sources.length === 1 && sources[0]?.kind === 'pr_title';
      if (titleOnly) usedSourceIndexes.add(0);
      if (usedSourceIndexes.size === 0) {
        return { status: 'unavailable', reasonCode: 'no_referenced_evidence', trace: { sourceCount: 0 } };
      }
      for (const index of usedSourceIndexes) {
        const evidenceIndex = sourceEvidenceIndexes[index]!;
        evidence[evidenceIndex]!.status = 'used';
      }
      if (classification.classification.insufficient_evidence && !titleOnly) return { status: 'unavailable', reasonCode: 'insufficient_evidence', trace: { sourceCount: sources.length } };
      const usedSources = [...usedSourceIndexes].map((index) => sources[index]!);
      const hasExternal = usedSources.some((source) => source.kind === 'github_issue' || source.kind === 'plan_spec');
      const hasDescription = usedSources.some((source) => source.kind === 'pr_description');
      const confidence: DerivedIntent['confidence'] = titleOnly ? 'low' : hasExternal ? 'high' : hasDescription ? 'medium' : 'low';
      const intent: DerivedIntent = {
        intent: titleOnly ? input.title.trim() : classification.classification.intent,
        in_scope: titleOnly ? [] : classification.classification.in_scope,
        out_of_scope: titleOnly ? [] : classification.classification.out_of_scope,
        confidence, evidence, source_fingerprint: sourceFingerprint, model_provider: resolved.provider, model: resolved.model, derived_at: new Date().toISOString(),
      };
      await this.deps.intents.upsertDerivedIntent(input.prId, intent);
      return { status: 'derived', intent, trace: { confidence, sourceCount: usedSources.length, provider: resolved.provider, model: resolved.model, persistence: cached ? 'updated' : 'created' } };
    } catch { return { status: 'unavailable', reasonCode: 'model_failed', trace: { sourceCount: sources.length } }; }
  }
}
