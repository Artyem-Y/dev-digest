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
const MAX_CONCURRENT_DOCUMENT_FETCHES = 2;

const cacheFingerprint = (title: string, body: string | null) => `v2:${digest(JSON.stringify({ title, body }))}`;
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
  constructor(private readonly deps: {
    documents: PublicDocumentFetcher;
    linkedIssues: LinkedIssueReader;
    featureModels: FeatureModelResolver;
    llm: IntentLlmResolver;
    intents: IntentRepositoryPort;
  }) {}

  async derive(input: IntentInput): Promise<IntentDerivation> {
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
    const sourceFingerprint = cacheFingerprint(input.title, input.body);
    if (!input.force && cached && cached.source_fingerprint === sourceFingerprint && cached.model_provider === resolved.provider && cached.model === resolved.model && isFresh(cached.derived_at)) {
      return { status: 'derived', intent: cached, trace: { confidence: cached.confidence, sourceCount: cached.evidence.length, provider: cached.model_provider, model: cached.model, persistence: 'reused' } };
    }

    const evidence: Evidence[] = [];
    const sources: { kind: SourceKind; text: string }[] = [];
    const add = (kind: SourceKind, text: string) => { const value = text.trim(); if (value) { sources.push({ kind, text: value }); evidence.push({ source_kind: kind, status: 'used', reason_code: null, content_fingerprint: digest(value) }); } };
    add('pr_title', input.title);
    if (input.body) add('pr_description', input.body);
    const linkedIssue = this.deps.linkedIssues
      .findLinkedIssue(input.repo, input.body)
      .catch(() => undefined);
    const documents = fetchDocuments(planSpecLinks(input.body ?? ''), this.deps.documents);
    const [issue, planSpecs] = await Promise.all([linkedIssue, documents]);
    if (issue) add('github_issue', `${issue.title}\n${issue.body ?? ''}`);
    for (const result of planSpecs) {
      if (result.ok) add('plan_spec', result.text);
      else evidence.push({ source_kind: 'plan_spec', status: result.reasonCode === 'url_rejected' ? 'rejected' : 'unavailable', reason_code: result.reasonCode, content_fingerprint: null });
    }
    if (sources.length === 0) return { status: 'unavailable', reasonCode: 'no_usable_evidence', trace: { sourceCount: 0 } };
    try {
      const classification = await derivePullIntent({ provider: await this.deps.llm.resolve(resolved.provider), model: resolved.model, sources });
      const titleOnly = evidence.length === 1 && evidence[0]?.source_kind === 'pr_title';
      if (classification.classification.insufficient_evidence && !titleOnly) return { status: 'unavailable', reasonCode: 'insufficient_evidence', trace: { sourceCount: sources.length } };
      const hasExternal = evidence.some((item) => item.status === 'used' && (item.source_kind === 'github_issue' || item.source_kind === 'plan_spec'));
      const confidence: DerivedIntent['confidence'] = titleOnly ? 'low' : hasExternal ? 'high' : input.body?.trim() ? 'medium' : 'low';
      const intent: DerivedIntent = {
        intent: titleOnly ? input.title.trim() : classification.classification.intent,
        in_scope: titleOnly ? [] : classification.classification.in_scope,
        out_of_scope: titleOnly ? [] : classification.classification.out_of_scope,
        confidence, evidence, source_fingerprint: sourceFingerprint, model_provider: resolved.provider, model: resolved.model, derived_at: new Date().toISOString(),
      };
      await this.deps.intents.upsertDerivedIntent(input.prId, intent);
      return { status: 'derived', intent, trace: { confidence, sourceCount: evidence.length, provider: resolved.provider, model: resolved.model, persistence: cached ? 'updated' : 'created' } };
    } catch { return { status: 'unavailable', reasonCode: 'model_failed', trace: { sourceCount: sources.length } }; }
  }
}
