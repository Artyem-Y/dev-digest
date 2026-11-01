import { expect, it } from 'vitest';
import { findFixture, fixtureHash, listFixtures, resolveFixture } from '../src/modules/evals/infrastructure/prepared-fixtures.js';

it('exposes only registered prepared fixtures and rejects missing or changed content', () => {
  const fixture = findFixture('synthetic-unchecked-division-v1')!;
  expect(listFixtures()).toContain(fixture);
  const hash = fixtureHash(fixture);
  expect(resolveFixture(fixture.id, hash)).toEqual(fixture);
  expect(resolveFixture(fixture.id, fixtureHash({ ...fixture, diff: fixture.diff + 'changed' }))).toBeUndefined();
  expect(resolveFixture('missing', hash)).toBeUndefined();
});
