import base from './vitest.config.js';
import { defineConfig } from 'vitest/config';

/** Docker-backed persistence suite; intentionally separate from hermetic units. */
export default defineConfig({
  ...base,
  test: { ...base.test, include: ['test/**/*.it.test.ts'] },
});
