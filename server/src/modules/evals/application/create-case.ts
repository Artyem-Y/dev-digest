import type { Anchor } from '../domain/score.js';
import type { EvalCaseSnapshot } from './run-suite.js';

export interface SourceFinding {
  id: string;
  agentId: string | null;
  title: string;
  anchor: Anchor;
  accepted: boolean;
  dismissed: boolean;
  fixture: { id: string; hash: string; anchor: Anchor; diff?: string } | null;
}

export class CaseCreationError extends Error {
  constructor(public readonly code: 'undecided' | 'missing_agent' | 'provenance_unavailable' | 'input_too_large' | 'sensitive_input') { super(code); }
}

/** Convert only an actual, anchored saved review input into a replay case. */
export function caseFromFinding(source: SourceFinding): Omit<EvalCaseSnapshot, 'id'> {
  if (source.accepted === source.dismissed) throw new CaseCreationError('undecided');
  if (!source.agentId) throw new CaseCreationError('missing_agent');
  const fixture = source.fixture;
  if (!fixture || fixture.anchor.file !== source.anchor.file || fixture.anchor.startLine !== source.anchor.startLine || fixture.anchor.endLine !== source.anchor.endLine) {
    throw new CaseCreationError('provenance_unavailable');
  }
  return {
    expectation: source.accepted ? 'must_find' : 'must_not_flag', anchor: { ...source.anchor },
    fixtureId: fixture.id, fixtureHash: fixture.hash, ...(fixture.diff === undefined ? {} : { diff: fixture.diff }),
  };
}
