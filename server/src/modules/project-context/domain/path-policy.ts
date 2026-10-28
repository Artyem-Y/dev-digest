import { normalize, posix } from 'node:path';

/** Normalize a repository-relative path without ever resolving it against cwd. */
export function normalizeProjectPath(input: string): string | null {
  if (!input || input.includes('\0') || input.includes('\\') || /^[A-Za-z]:/.test(input)) return null;
  if (posix.isAbsolute(input) || input.startsWith('/')) return null;
  if (input.split('/').includes('..')) return null;
  const value = normalize(input).replaceAll('\\', '/');
  if (!value || value === '.' || value === '..' || value.startsWith('../') || value.includes('/../')) return null;
  return value;
}

export const DEFAULT_PROJECT_CONTEXT_ROOTS = ['specs', 'docs', 'insights'] as const;

export function isEligibleMarkdownPath(path: string, roots: readonly string[] = DEFAULT_PROJECT_CONTEXT_ROOTS): boolean {
  const normalized = normalizeProjectPath(path);
  if (normalized === null || !/\.md$/i.test(normalized)) return false;
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '.git' || segment === 'node_modules')) return false;
  const directories = segments.slice(0, -1);
  return roots.some((root) => {
    const normalizedRoot = normalizeProjectPath(root);
    if (!normalizedRoot) return false;
    const parts = normalizedRoot.split('/');
    return directories.some((_, index) => parts.every((part, offset) => directories[index + offset] === part));
  });
}
