import { createHash } from 'node:crypto';
import type { DerivedIntent, Provider } from '@devdigest/shared';
import { derivePullIntent } from '@devdigest/reviewer-core';
import type { FeatureModelResolver, IntentLlmResolver, IntentRepoRef, IntentRepositoryPort, LinkedIssueReader, PublicDocumentFetcher } from './ports.js';

type SourceKind = 'pr_title' | 'pr_description' | 'github_issue' | 'plan_spec';
type Evidence = DerivedIntent['evidence'][number];
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const planSpecLinks = (body: string) => [...body.matchAll(/(?:plan|spec)\s*(?:\[[^\]]*\]\s*)?\(?\s*(https:\/\/[^\s)\]>]+)/gi)]
  .map((match) => match[1]).filter((value): value is string => Boolean(value)).slice(0, 3);

export interface IntentInput {
  workspaceId: string;
  prId: string;
  title: string;
  body: string | null;
  repo: IntentRepoRef;
}
export type IntentDerivation =
  | { status: 'derived'; intent: DerivedIntent; trace: { confidence: DerivedIntent['confidence']; sourceCount: number; provider: Provider; model: string } }
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
    const evidence: Evidence[] = [];
    const sources: { kind: SourceKind; text: string }[] = [];
    const add = (kind: SourceKind, text: string) => { const value = text.trim(); if (value) { sources.push({ kind, text: value }); evidence.push({ source_kind: kind, status: 'used', reason_code: null, content_fingerprint: digest(value) }); } };
    add('pr_title', input.title);
    if (input.body) add('pr_description', input.body);
    try {
      const linkedIssue = await this.deps.linkedIssues.findLinkedIssue(input.repo, input.body);
      if (linkedIssue) add('github_issue', `${linkedIssue.title}\n${linkedIssue.body ?? ''}`);
    } catch {
      // Linked tickets are optional evidence and must not make a review unavailable.
    }
    for (const candidate of planSpecLinks(input.body ?? '')) {
      const result = await this.deps.documents.fetchPlanOrSpec(candidate);
      if (result.ok) add('plan_spec', result.text);
      else evidence.push({ source_kind: 'plan_spec', status: result.reasonCode === 'url_rejected' ? 'rejected' : 'unavailable', reason_code: result.reasonCode, content_fingerprint: null });
    }
    if (sources.length === 0) return { status: 'unavailable', reasonCode: 'no_usable_evidence', trace: { sourceCount: 0 } };
    let resolved: { provider: Provider; model: string };
    try { resolved = await this.deps.featureModels.resolve(input.workspaceId); } catch { return { status: 'unavailable', reasonCode: 'model_unavailable', trace: { sourceCount: sources.length } }; }
    const sourceFingerprint = digest(sources.map((source) => source.text).join('\n'));
    const cached = await this.deps.intents.getDerivedIntent(input.prId);
    if (cached && cached.source_fingerprint === sourceFingerprint && cached.model_provider === resolved.provider && cached.model === resolved.model) {
      return { status: 'derived', intent: cached, trace: { confidence: cached.confidence, sourceCount: cached.evidence.length, provider: cached.model_provider, model: cached.model } };
    }
    try {
      const classification = await derivePullIntent({ provider: await this.deps.llm.resolve(resolved.provider), model: resolved.model, sources });
      if (classification.classification.insufficient_evidence) return { status: 'unavailable', reasonCode: 'insufficient_evidence', trace: { sourceCount: sources.length } };
      const hasExternal = evidence.some((item) => item.status === 'used' && (item.source_kind === 'github_issue' || item.source_kind === 'plan_spec'));
      const confidence: DerivedIntent['confidence'] = hasExternal ? 'high' : input.body?.trim() ? 'medium' : 'low';
      const intent: DerivedIntent = { intent: classification.classification.intent, in_scope: classification.classification.in_scope, out_of_scope: classification.classification.out_of_scope, confidence, evidence, source_fingerprint: sourceFingerprint, model_provider: resolved.provider, model: resolved.model, derived_at: new Date().toISOString() };
      await this.deps.intents.upsertDerivedIntent(input.prId, intent);
      return { status: 'derived', intent, trace: { confidence, sourceCount: evidence.length, provider: resolved.provider, model: resolved.model } };
    } catch { return { status: 'unavailable', reasonCode: 'model_failed', trace: { sourceCount: sources.length } }; }
  }
}
