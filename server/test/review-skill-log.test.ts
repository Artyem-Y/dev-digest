import { describe, expect, it } from 'vitest';
import { skillsAttachedLogMessage } from '../src/modules/reviews/run-executor.js';

describe('skillsAttachedLogMessage', () => {
  it('names the exact skills that will be attached to an agent review', () => {
    expect(skillsAttachedLogMessage([
      { name: 'API compatibility', body: 'Keep public fields compatible.' },
      { name: 'Security baseline', body: 'Flag unsafe authorization changes.' },
    ])).toBe('Skills attached: API compatibility, Security baseline');
  });

  it('reports when no skills are attached', () => {
    expect(skillsAttachedLogMessage([])).toBe('Skills attached: none');
  });
});
