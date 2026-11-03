import { createHash } from 'node:crypto';
import type { Anchor } from '../domain/score.js';

/** Only reviewed, non-secret inputs may be registered here. A binding is explicit:
 * a coincidentally equal path/line must never associate a real finding with a fixture. */
export interface PreparedFixture {
  id: string;
  anchor: Anchor;
  diff: string;
  metadata: { title: string; description: string | null };
}

// Synthetic teaching input. It contains no copied source or credentials.
const fixtures: readonly PreparedFixture[] = [{
  id: 'synthetic-unchecked-division-v1',
  anchor: { file: 'synthetic/divide.ts', startLine: 2, endLine: 2 },
  diff: 'diff --git a/synthetic/divide.ts b/synthetic/divide.ts\n--- a/synthetic/divide.ts\n+++ b/synthetic/divide.ts\n@@ -0,0 +1,3 @@\n+export function divide(a: number, b: number) {\n+  return a / b;\n+}\n',
  metadata: { title: 'Synthetic division example', description: 'Prepared example: division without a zero guard.' },
}, {
  id: 'synthetic-identity-v1',
  anchor: { file: 'synthetic/identity.ts', startLine: 2, endLine: 2 },
  diff: 'diff --git a/synthetic/identity.ts b/synthetic/identity.ts\n--- a/synthetic/identity.ts\n+++ b/synthetic/identity.ts\n@@ -0,0 +1,3 @@\n+export function identity(value: string) {\n+  return value;\n+}\n',
  metadata: { title: 'Synthetic identity example', description: 'Prepared example: an ordinary identity function.' },
}];

export function fixtureHash(fixture: PreparedFixture): string {
  return createHash('sha256').update(JSON.stringify({ id: fixture.id,
    anchor: fixture.anchor, diff: fixture.diff, metadata: fixture.metadata })).digest('hex');
}

export function listFixtures(): readonly PreparedFixture[] { return fixtures; }

export function findFixture(id: string): PreparedFixture | undefined {
  return fixtures.find((fixture) => fixture.id === id);
}

export function resolveFixture(id: string, hash: string): PreparedFixture | undefined {
  const fixture = fixtures.find((entry) => entry.id === id);
  return fixture && fixtureHash(fixture) === hash ? fixture : undefined;
}
