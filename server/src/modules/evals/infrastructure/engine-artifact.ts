import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type * as Engine from '../engine-entry.js';

export type EvalEngine = typeof Engine;

/** Load and execute exactly the bytes hashed here; missing or invalid bundles are unverified. */
export async function loadEvalEngine(path = resolve('dist/eval-engine.mjs'), manifestPath = resolve('dist/eval-engine.manifest.json')): Promise<{ version: string; engine: EvalEngine } | null> {
  try {
    const [bytes, manifestBytes] = await Promise.all([readFile(path), readFile(manifestPath, 'utf8')]);
    const manifest: unknown = JSON.parse(manifestBytes);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (!manifest || typeof manifest !== 'object' || !('sha256' in manifest) || manifest.sha256 !== digest) return null;
    const hash = createHash('sha256').update(bytes).update('\0').update(process.version)
      .update('\0').update(process.platform).update('\0').update(process.arch).digest('hex');
    const engine = await import(`data:text/javascript;base64,${bytes.toString('base64')}`) as EvalEngine;
    if (typeof engine.runSuite !== 'function' || typeof engine.createEvalReviewer !== 'function'
      || typeof engine.OpenAIProvider !== 'function' || typeof engine.AnthropicProvider !== 'function'
      || typeof engine.OpenRouterProvider !== 'function' || typeof engine.createProvider !== 'function'
      || typeof engine.secretKeyName !== 'function') return null;
    return { version: `sha256:${hash}`, engine };
  } catch {
    return null;
  }
}
