import type { SmartDiffRole } from '@devdigest/shared';
import { SMART_DIFF_RULES } from './constants.js';

/** Deterministically assign a pull-request path to its first matching role. */
export function classifyFile(path: string): SmartDiffRole {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const [role, patterns] of SMART_DIFF_RULES) {
    if (patterns.some((pattern) => pattern.test(normalized))) return role;
  }
  return 'core';
}
