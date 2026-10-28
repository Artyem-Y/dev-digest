import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isEligibleMarkdownPath, normalizeProjectPath } from '../domain/path-policy.js';
import type { DocumentRead, TrackedDocumentStore } from '../application/ports.js';

const execFileAsync = promisify(execFile);
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;

/** Read one immutable snapshot of the local main branch, never its worktree. */
export class GitTrackedDocumentStore implements TrackedDocumentStore {
  private entries?: Map<string, { object: string; mode: string }>;

  constructor(
    private readonly checkoutPath: string,
    private readonly roots?: readonly string[],
  ) {}

  async catalog(): Promise<string[]> {
    if (!this.entries) {
      const { stdout } = await execFileAsync('git', ['-C', this.checkoutPath, 'ls-tree', '-r', '-z', '--full-tree', 'refs/heads/main'], { maxBuffer: MAX_GIT_OUTPUT_BYTES });
      const entries = new Map<string, { object: string; mode: string }>();
      for (const record of stdout.split('\0')) {
        const match = /^(\d{6}) blob ([0-9a-f]{40,64})\t([\s\S]+)$/.exec(record);
        if (!match) continue;
        const [, mode, object, path] = match;
        if (!path || !mode || !object || !isEligibleMarkdownPath(path, this.roots)) continue;
        const normalized = normalizeProjectPath(path);
        if (normalized) entries.set(normalized, { object, mode });
      }
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
