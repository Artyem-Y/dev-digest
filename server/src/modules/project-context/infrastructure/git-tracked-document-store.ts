import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { StringDecoder } from 'node:string_decoder';
import type { Readable } from 'node:stream';
import { isEligibleMarkdownPath, normalizeProjectPath } from '../domain/path-policy.js';
import type { DocumentRead, TrackedDocumentStore } from '../application/ports.js';

const execFileAsync = promisify(execFile);
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;

export async function readTreeEntries(stream: Readable, roots?: readonly string[]): Promise<Map<string, { object: string; mode: string }>> {
  const entries = new Map<string, { object: string; mode: string }>();
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const consume = (record: string) => {
    const match = /^(\d{6}) blob ([0-9a-f]{40,64})\t([\s\S]+)$/.exec(record);
    if (!match) return;
    const [, mode, object, path] = match;
    if (!path || !mode || !object || !isEligibleMarkdownPath(path, roots)) return;
    const normalized = normalizeProjectPath(path);
    if (normalized) entries.set(normalized, { object, mode });
  };
  for await (const chunk of stream) {
    pending += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    let end: number;
    while ((end = pending.indexOf('\0')) !== -1) {
      consume(pending.slice(0, end));
      pending = pending.slice(end + 1);
    }
  }
  pending += decoder.end();
  if (pending) throw new Error('Incomplete Git tree listing');
  return entries;
}

/** Read one immutable snapshot of the local main branch, never its worktree. */
export class GitTrackedDocumentStore implements TrackedDocumentStore {
  private entries?: Map<string, { object: string; mode: string }>;

  constructor(
    private readonly checkoutPath: string,
    private readonly roots?: readonly string[],
  ) {}

  async catalog(): Promise<string[]> {
    if (!this.entries) {
      const child = spawn('git', ['-C', this.checkoutPath, 'ls-tree', '-r', '-z', '--full-tree', 'refs/heads/main'], { stdio: ['ignore', 'pipe', 'ignore'] });
      const exit = new Promise<void>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code) => code === 0 ? resolve() : reject(new Error('Git tree listing failed')));
      });
      const [entries] = await Promise.all([readTreeEntries(child.stdout, this.roots), exit]);
      this.entries = entries;
    }
    return [...this.entries.keys()].sort((a, b) => a.localeCompare(b));
  }

  async read(path: string): Promise<DocumentRead> {
    const normalized = normalizeProjectPath(path);
    if (!normalized) return { path, reason: 'no_longer_eligible' };
    await this.catalog();
    const entry = this.entries?.get(normalized);
    if (!entry || !['100644', '100755'].includes(entry.mode)) return { path: normalized, reason: 'no_longer_eligible' };
    try {
      const { stdout } = await execFileAsync('git', ['-C', this.checkoutPath, 'cat-file', 'blob', entry.object], { maxBuffer: MAX_GIT_OUTPUT_BYTES });
      return { path: normalized, content: stdout };
    } catch {
      return { path: normalized, reason: 'unreadable' };
    }
  }
}
