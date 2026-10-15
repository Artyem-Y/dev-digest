import { describe, expect, it } from 'vitest';
import { classifyFile } from '../src/modules/reviews/smart-diff/domain/classify-file.js';

describe('classifyFile', () => {
  it.each([
    ['src/billing/charge.ts', 'core'],
    ['server/src/charge.it.test.ts', 'tests'],
    ['client/src/Charge.test.tsx', 'tests'],
    ['src/charge.spec.ts', 'tests'],
    ['tests/fixture.ts', 'tests'],
    ['test/fixture.ts', 'tests'],
    ['src/__tests__/a.ts', 'tests'],
    ['e2e/README.md', 'tests'],
    ['src/index.ts', 'wiring'],
    ['vite.config.ts', 'wiring'],
    ['tsconfig.base.json', 'wiring'],
    ['.claude/skills/security/SKILL.md', 'wiring'],
    ['README.md', 'docs'],
    ['docs/guide.txt', 'docs'],
    ['src/guide.md', 'docs'],
    ['pnpm-lock.yaml', 'boilerplate'],
    ['packages/app/dist/a.js', 'boilerplate'],
    ['src/__tests__/__snapshots__/x.snap', 'boilerplate'],
    ['src/api.generated.ts', 'boilerplate'],
    ['assets/a.min.js', 'boilerplate'],
  ] as const)('classifies %s as %s', (path, role) => {
    expect(classifyFile(path)).toBe(role);
  });
});
