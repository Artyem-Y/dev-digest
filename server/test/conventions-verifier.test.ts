import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyConventionEvidence } from '../src/modules/conventions/application/verify-evidence.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true }))));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'devdigest-conventions-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'api.ts'), 'const first = 1;\nconst second = await load();\n');
  await writeFile(join(root, 'secret.ts'), 'export const secret = true;\n');
  return root;
}

describe('verifyConventionEvidence', () => {
  it('derives the snippet from a sampled regular file line', async () => {
    const root = await fixture();

    await expect(verifyConventionEvidence(root, new Set(['src/api.ts']), 'src/api.ts', 2)).resolves.toEqual({
      evidencePath: 'src/api.ts',
      evidenceLine: 2,
      evidenceSnippet: 'const second = await load();',
    });
  });

  it('rejects paths that escape, are unsampled, or resolve through a symlink', async () => {
    const root = await fixture();
    await symlink(join(root, 'secret.ts'), join(root, 'src', 'linked.ts'));

    await expect(verifyConventionEvidence(root, new Set(['src/api.ts']), '../secret.ts', 1)).resolves.toBeNull();
    await expect(verifyConventionEvidence(root, new Set(['src/api.ts']), 'secret.ts', 1)).resolves.toBeNull();
    await expect(verifyConventionEvidence(root, new Set(['src/linked.ts']), 'src/linked.ts', 1)).resolves.toBeNull();
  });
});
