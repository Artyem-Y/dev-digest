import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const git = promisify(execFile);
const MAX_SOURCE_BYTES = 256 * 1024;

/** Caller must resolve checkoutPath through an authorized workspace/repository lookup. */
export class RevisionSourceReader {
  constructor(private readonly checkoutPath: string, readonly revision: string, private readonly runGit: typeof git = git) {
    if (!/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(revision)) throw new Error('Invalid source revision');
  }

  async available(): Promise<boolean> {
    try {
      await this.runGit('git', ['-C', this.checkoutPath, 'cat-file', '-e', `${this.revision}^{commit}`], { maxBuffer: 4096, timeout: 10_000 });
      return true;
    } catch { return false; }
  }

  async read(path: string): Promise<string | null> {
    if (path.split('/').some((part) => part === '.env' || part.startsWith('.env.'))) return null;
    if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some((p) => !p || p === '.' || p === '..')) return null;
    try {
      const { stdout } = await this.runGit('git', ['-C', this.checkoutPath, 'ls-tree', '-z', this.revision, '--', `:(literal)${path}`], { maxBuffer: 4096, timeout: 10_000 });
      const match = /^(100644|100755) blob ([0-9a-f]{40,64})\t([^\0]+)\0$/.exec(stdout);
      if (!match || match[3] !== path) return null;
      const blob = await this.runGit('git', ['-C', this.checkoutPath, 'cat-file', 'blob', match[2]!], { maxBuffer: MAX_SOURCE_BYTES, timeout: 10_000 });
      return blob.stdout;
    } catch {
      return null;
    }
  }
}
