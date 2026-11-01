import { caseFromFinding, type SourceFinding, type CaseCreationError } from './create-case.js';
import { hasContradictoryLabels } from './dataset.js';
import type { EvalCaseSnapshot } from './run-suite.js';

export interface CaseRecord extends EvalCaseSnapshot { agentId: string; findingId: string | null; name: string }
export interface CasesPort {
  source(workspaceId: string, findingId: string, fixtureId?: string): Promise<SourceFinding | undefined>;
  findByDecision(workspaceId: string, findingId: string, decision: 'accepted' | 'dismissed'): Promise<CaseRecord | undefined>;
  list(workspaceId: string, agentId: string): Promise<CaseRecord[]>;
  insert(workspaceId: string, source: SourceFinding, snapshot: Omit<EvalCaseSnapshot, 'id'>): Promise<{ created: boolean; value: CaseRecord }>;
}

export class CaseConflict extends Error {
  constructor(public readonly code: 'contradictory_labels' | 'decision_changed' | 'fixture_changed') { super(code); }
}

export async function createCase(port: CasesPort, workspaceId: string, findingId: string, fixtureId?: string): Promise<{ created: boolean; value: CaseRecord } | undefined> {
  const source = await port.source(workspaceId, findingId, fixtureId);
  if (!source) return undefined;
  const decision = source.accepted ? 'accepted' : 'dismissed';
  const existing = await port.findByDecision(workspaceId, findingId, decision);
  if (existing) {
    if (source.accepted === source.dismissed) throw new CaseConflict('decision_changed');
    return { created: false, value: existing };
  }
  const snapshot = caseFromFinding(source);
  const cases = await port.list(workspaceId, source.agentId!);
  if (hasContradictoryLabels([...cases, { ...snapshot, id: '' }])) throw new CaseConflict('contradictory_labels');
  return port.insert(workspaceId, source, snapshot);
}

// Errors remain domain/application values; the HTTP adapter maps them to status codes.
export type CreateCaseFailure = CaseCreationError | CaseConflict;
