import { describe, expect, it } from 'vitest';
import { filterBriefOutput } from '../src/modules/brief/domain/filter-output.js';

describe('filterBriefOutput', () => {
  it('drops ungrounded risk refs and Blast-only focus while retaining changed-file targets', () => {
    const output = filterBriefOutput({
      summary: 'Why',
      risks: { risks: [
        { kind: 'security', title: 'Keep', explanation: 'x', severity: 'high', file_refs: ['src/a.ts', '/etc/passwd'] },
        { kind: 'bug', title: 'Drop', explanation: 'x', severity: 'low', file_refs: ['invented.ts'] },
      ] },
      review_focus: [
        { file: 'src/a.ts', line: 3, reason: 'changed' },
        { file: 'src/caller.ts', line: 4, reason: 'blast only' },
      ],
    }, ['src/a.ts'], ['src/caller.ts'], 'sha');
    expect(output.risks.risks).toHaveLength(1);
    expect(output.risks.risks[0]?.file_refs).toEqual(['src/a.ts']);
    expect(output.review_focus).toEqual([{ file: 'src/a.ts', line: 3, reason: 'changed' }]);
  });
});
