import { expect, it } from 'vitest';
import { admittedCase, SuiteAdmissionError } from '../src/modules/evals/infrastructure/suite-repository.js';
import { fixtureHash, listFixtures } from '../src/modules/evals/infrastructure/prepared-fixtures.js';

it('whitelists valid case fields and never propagates legacy raw source', () => {
  const fixture = listFixtures()[0]!;
  const snapshot = { expectation: 'must_find', fixtureId: fixture.id, fixtureHash: fixtureHash(fixture),
    anchor: { ...fixture.anchor, diff: 'nested secret' }, diff: 'legacy secret', metadata: { body: 'private' } };
  const result = admittedCase('case-id', snapshot);
  expect(result).toEqual({ id: 'case-id', expectation: 'must_find', anchor: fixture.anchor,
    fixtureId: fixture.id, fixtureHash: fixtureHash(fixture) });
  expect(JSON.stringify(result)).not.toContain('secret');
  expect(JSON.stringify(result)).not.toContain('private');
});

it('rejects invalid, modified or unavailable fixture references and anchors', () => {
  const fixture = listFixtures()[0]!;
  const snapshot = { expectation: 'must_find', fixtureId: fixture.id, fixtureHash: fixtureHash(fixture), anchor: fixture.anchor };
  for (const invalid of [null, { ...snapshot, expectation: 'other' }, { ...snapshot, fixtureHash: 'a'.repeat(64) },
    { ...snapshot, anchor: { ...fixture.anchor, startLine: 0 } }, { ...snapshot, anchor: { ...fixture.anchor, file: 'other' } }]) {
    expect(() => admittedCase('id', invalid)).toThrow(SuiteAdmissionError);
  }
});
