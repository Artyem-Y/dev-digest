import { assembleBriefPrompt, estimateBriefPromptTokens, generateBrief, type BriefModelFacts, type BriefProjectDocument } from '@devdigest/reviewer-core';
import type { BriefSourceStatus } from '@devdigest/shared';
import { AppError, ConfigError, ExternalServiceError, NotFoundError } from '../../../platform/errors.js';
import { selectBriefBudget } from '../domain/budget.js';
import { filterBriefOutput } from '../domain/filter-output.js';
import { BriefInFlight } from '../domain/in-flight.js';
import type { BriefDependencies, BriefResponse } from './ports.js';
import { assembleFacts } from './assemble-facts.js';

const MODEL_PATH_MAX_CHARS = 160;
const MODEL_INPUT_TOKEN_LIMIT = 8_000;

function sourceKey(status: BriefSourceStatus): string {
  if (status.source_kind === 'changed_file') return `changed_file:${status.path}`;
  return status.source_kind;
}

/** Measure the exact reviewer-core serialization and remove lowest-priority input until it fits. */
function fitPrompt(facts: BriefModelFacts, documents: BriefProjectDocument[]) {
  const selected = [...documents];
  let boundedFacts = { ...facts };
  while (estimateBriefPromptTokens(assembleBriefPrompt({ facts: boundedFacts, project_documents: selected })) > MODEL_INPUT_TOKEN_LIMIT) {
    if (selected.length > 0) { selected.pop(); continue; }
    if (boundedFacts.metadata.length > 0) {
      const current = estimateBriefPromptTokens(assembleBriefPrompt({ facts: boundedFacts, project_documents: selected }));
      const excess = current - MODEL_INPUT_TOKEN_LIMIT;
      boundedFacts = { ...boundedFacts, metadata: boundedFacts.metadata.slice(0, Math.max(0, boundedFacts.metadata.length - Math.max(1, excess * 4))) };
      continue;
    }
    boundedFacts = { ...boundedFacts, source_availability: '[]' };
    break;
  }
  return { facts: boundedFacts, documents: selected };
}

function compactPromptStatuses(statuses: BriefSourceStatus[]) {
  return statuses.slice(0, 16).map(({ source_kind, path, status, reason_code, estimated_tokens }) => ({
    source_kind, path: path?.slice(0, 160) ?? null, status,
    reason_code: reason_code?.slice(0, 80) ?? null, estimated_tokens,
  }));
}

export class GenerateBrief {
  constructor(private readonly deps: BriefDependencies, private readonly inFlight: BriefInFlight) {}
  async execute(workspaceId: string, prId: string): Promise<BriefResponse> {
    if (!this.inFlight.acquire(prId)) throw new AppError('brief_generation_in_progress', 'Brief generation is already in progress', 409);
    try {
      const snapshot = await this.deps.read.getSnapshot(workspaceId, prId);
      if (!snapshot) throw new NotFoundError('Pull request not found');
      const capturedSha = snapshot.headSha;
      if (this.deps.blast) {
        try { snapshot.blast = await this.deps.blast.resolve(snapshot); }
        // Blast is optional enrichment: retain unavailable rather than failing
        // Brief generation or pretending an empty result was successfully read.
        catch { snapshot.blast = undefined; }
      }
      const facts = assembleFacts(snapshot);
      let context;
      try { context = await this.deps.projectContext.resolve({ workspaceId, repoId: snapshot.repoId }); }
      catch { throw new ExternalServiceError('Project Context is unavailable'); }
      // Each fact is selected independently and in deterministic priority order;
      // a long body cannot silently crowd changed-file or derived evidence out.
      const selection = selectBriefBudget(facts.components, context.documents.map((document) => ({ path: document.path, content: document.content, estimatedTokens: document.estimatedTokens })));
      const selectedFacts = new Set(selection.facts.map((fact) => fact.key));
      const truncatedFacts = new Set(selection.facts
        .filter((fact) => facts.components.find((component) => component.key === fact.key)?.content.length !== fact.content.length)
        .map((fact) => fact.key));
      const baseStatuses: BriefSourceStatus[] = [
        ...facts.statuses.map((status) => {
          const selected = selection.facts.find((fact) => fact.key === sourceKey(status));
          if (status.status !== 'available') return status;
          return selected
            ? { ...status, reason_code: truncatedFacts.has(selected.key) ? 'truncated_to_budget' : status.reason_code, estimated_tokens: selected.estimatedTokens }
            : { ...status, status: 'omitted' as const, reason_code: 'budget_exhausted', estimated_tokens: 0 };
        }),
        ...context.documents.map((document) => {
          const selected = selection.specs.find((spec) => spec.path === document.path);
          return { source_kind: 'spec' as const, path: document.path, provenance: 'tracked_checkout' as const, status: selected ? 'available' as const : 'omitted' as const, reason_code: selected ? null : 'budget_exhausted', estimated_tokens: selected?.estimatedTokens ?? 0 };
        }),
        ...context.skipped.map((document) => ({ source_kind: 'spec' as const, path: document.path, provenance: 'tracked_checkout' as const, status: 'unavailable' as const, reason_code: document.reason, estimated_tokens: 0 })),
      ];
      let model;
      try { model = await this.deps.featureModels.resolve(workspaceId); }
      catch { throw new ConfigError('Brief model is not configured'); }
      let provider;
      try { provider = await this.deps.llm.resolve(model.provider); }
      catch { throw new ConfigError('Brief model is unavailable'); }
      const baseFacts: Omit<BriefModelFacts, 'source_availability'> = {
        metadata: selection.facts.map((fact) => fact.content).join('\n\n'),
        intent: snapshot.intent ? { status: 'available', content: '' } : { status: 'unavailable', content: '' },
        blast: snapshot.blast ? { status: 'available', content: '' } : { status: 'unavailable', content: '' },
        smart_diff: snapshot.smartDiff ? { status: 'available', content: '' } : { status: 'unavailable', content: '' },
      };
      const modelDocuments: BriefProjectDocument[] = selection.specs.map((spec) => ({
        // The full normalized path stays in cache telemetry/statuses. The model
        // only needs a bounded label, preventing attachment names from becoming
        // an unmetered prompt channel.
        path: spec.path!.slice(0, MODEL_PATH_MAX_CHARS),
        content: spec.content,
      }));
      // Feed the final selected-status view back through canonical rendering.
      // Iteration settles when status metadata no longer forces another document
      // out of the exact 8k request budget.
      let selectedCount = modelDocuments.length;
      let fitted = fitPrompt({ ...baseFacts, source_availability: JSON.stringify(compactPromptStatuses(baseStatuses)) }, modelDocuments);
      let statuses = baseStatuses;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const selectedPaths = new Set(selection.specs.slice(0, fitted.documents.length).map((spec) => spec.path));
        statuses = baseStatuses.map((status) => status.source_kind === 'spec' && status.status === 'available' && status.path && !selectedPaths.has(status.path)
          ? { ...status, status: 'omitted' as const, reason_code: 'budget_exhausted', estimated_tokens: 0 }
          : status);
        const candidateFacts = { ...baseFacts, source_availability: JSON.stringify(compactPromptStatuses(statuses)) };
        const next = fitPrompt(candidateFacts, modelDocuments.slice(0, selectedCount));
        fitted = next;
        if (next.documents.length === selectedCount) break;
        selectedCount = next.documents.length;
      }
      let generated;
      try { generated = await generateBrief({ provider, model: model.model, maxRetries: 0, facts: fitted.facts, project_documents: fitted.documents }); }
      catch { throw new ExternalServiceError('Brief generation failed'); }
      let filtered;
      try { filtered = filterBriefOutput(generated.output, snapshot.files.map((file) => file.path), snapshot.blast?.callers?.map((caller) => caller.file) ?? [], capturedSha); }
      catch { throw new ExternalServiceError('Brief output could not be validated'); }
      const enriched = { ...filtered, intent: snapshot.intent ?? filtered.intent, blast: snapshot.blast ?? filtered.blast };
      const exactEstimatedTokens = estimateBriefPromptTokens(assembleBriefPrompt({ facts: fitted.facts, project_documents: fitted.documents }));
      const selectedPaths = new Set(selection.specs.slice(0, fitted.documents.length).map((spec) => spec.path));
      await this.deps.read.replace(workspaceId, prId, { brief: enriched, sources: statuses, telemetry: {
        provider: generated.provider, model: generated.model, estimated_tokens: exactEstimatedTokens, call_count: 1,
        selected_documents: fitted.documents.length, skipped_documents: context.skipped.length,
        selected_fact_sources: [...selectedFacts],
        omitted_fact_sources: facts.statuses.filter((status) => status.status === 'available' && !selectedFacts.has(sourceKey(status))).map(sourceKey),
        truncated_fact_sources: [...truncatedFacts],
        document_provenance: context.documents.filter((document) => selectedPaths.has(document.path)).map((document) => ({ path: document.path, provenance: document.provenance })),
      } });
      return { cache: { cache_state: 'current', brief: enriched }, sources: statuses };
    } finally { this.inFlight.release(prId); }
  }
}
