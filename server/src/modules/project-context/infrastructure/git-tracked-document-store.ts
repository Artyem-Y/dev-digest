import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { promisify } from 'node:util';
import { relative, resolve } from 'node:path';
import { isEligibleMarkdownPath, normalizeProjectPath } from '../domain/path-policy.js';
import type { DocumentRead, TrackedDocumentStore } from '../application/ports.js';

const execFileAsync = promisify(execFile);

/**
 * A checkout-only store: it trusts neither a client path nor `git ls-files`
 * alone. A symlink target must remain under the checkout's resolved root.
 */
export class GitTrackedDocumentStore implements TrackedDocumentStore {
  private cachedCatalog?: string[];
  private resolvedRoot?: string;

  constructor(
    private readonly checkoutPath: string,
    /** Test seam proving that a path replacement between validation and open is fail-closed. */
    private readonly beforeOpen?: () => Promise<void>,
  ) {}

  async catalog(): Promise<string[]> {
    if (this.cachedCatalog) return this.cachedCatalog;
    const { stdout } = await execFileAsync('git', ['-C', this.checkoutPath, 'ls-files', '-z'], { maxBuffer: 8 * 1024 * 1024 });
    this.cachedCatalog = stdout.split('\0').filter(isEligibleMarkdownPath).map((path) => normalizeProjectPath(path)!).sort((a, b) => a.localeCompare(b));
    return this.cachedCatalog;
  }

  async read(path: string): Promise<DocumentRead> {
    const normalized = normalizeProjectPath(path);
    if (!normalized || !(await this.catalog()).includes(normalized)) return { path, reason: 'no_longer_eligible' };
    try {
      const root = this.resolvedRoot ??= await realpath(this.checkoutPath);
      const target = await realpath(resolve(root, normalized));
      if (!isWithin(root, target)) return { path: normalized, reason: 'no_longer_eligible' };
      await this.beforeOpen?.();
      // Open the resolved candidate without following a swapped final symlink,
      // then validate the opened descriptor's actual target before reading it.
      const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const openedTarget = await openedFilePath(handle.fd);
        if (!openedTarget || !isWithin(root, openedTarget) || !(await handle.stat()).isFile()) {
          return { path: normalized, reason: 'no_longer_eligible' };
        }
        return { path: normalized, content: await handle.readFile({ encoding: 'utf8' }) };
      } finally {
        await handle.close();
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return { path: normalized, reason: code === 'ENOENT' ? 'missing' : code === 'ELOOP' ? 'no_longer_eligible' : 'unreadable' };
    }
  }
}

/** Resolve the opened vnode, not the original path, so parent-directory swaps fail closed. */
async function openedFilePath(fd: number): Promise<string | null> {
  if (process.platform !== 'darwin') return realpath(`/proc/self/fd/${fd}`).catch(() => null);
  try {
    // Darwin's /dev/fd/N resolves to itself rather than the vnode path. lsof
    // queries the open descriptor and emits NUL-delimited fields; failures are
    // unavailable, never a reason to trust the pre-open path.
    const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(process.pid), '-d', String(fd), '-F0n'], { timeout: 5000, maxBuffer: 65536 });
    const names = stdout.split('\0').map((field) => field.replace(/^\n/, '')).filter((field) => field.startsWith('n/'));
    return names.length === 1 ? names[0]!.slice(1) : null;
  } catch { return null; }
}

function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel !== '' && rel !== '..' && !rel.startsWith('../') && resolve(root, rel) === target;
}
