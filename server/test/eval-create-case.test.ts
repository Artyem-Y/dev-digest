import { describe, expect, it } from 'vitest';
import { caseFromFinding, CaseCreationError, type SourceFinding } from '../src/modules/evals/application/create-case.js';
import { createCase } from '../src/modules/evals/application/cases.js';

const source: SourceFinding = {
  id: 'finding', agentId: 'agent', title: 'Issue', anchor: { file: 'src/a.ts', startLine: 5, endLine: 6 },
  accepted: true, dismissed: false,
  fixture: { id: 'synthetic', hash: 'hash', anchor: { file: 'src/a.ts', startLine: 5, endLine: 6 } },
};

describe('create eval case', () => {
  it('derives the expectation from the persisted decision', () => {
    expect(caseFromFinding(source).expectation).toBe('must_find');
    expect(caseFromFinding({ ...source, accepted: false, dismissed: true }).expectation).toBe('must_not_flag');
  });
  it('rejects undecided findings and unavailable or unanchored source', () => {
    expect(() => caseFromFinding({ ...source, accepted: false })).toThrow(CaseCreationError);
    expect(() => caseFromFinding({ ...source, fixture: null })).toThrow('provenance_unavailable');
    expect(() => caseFromFinding({ ...source, anchor: { ...source.anchor, startLine: 10, endLine: 10 } })).toThrow('provenance_unavailable');
  });
});

it('returns an existing decision without inserting a duplicate', async () => {
  const snapshot = { ...caseFromFinding(source), id: 'case', agentId: 'agent', findingId: 'finding', name: 'Issue' };
  let inserted = false;
  const result = await createCase({ source: async () => source, findByDecision: async () => snapshot,
    list: async () => [], insert: async () => { inserted = true; return { created: true, value: snapshot }; } }, 'workspace', 'finding', 'synthetic');
  expect(result).toEqual({ created: false, value: snapshot });
  expect(inserted).toBe(false);
});
