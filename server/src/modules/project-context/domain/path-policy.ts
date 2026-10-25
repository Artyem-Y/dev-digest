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

export function isEligibleMarkdownPath(path: string): boolean {
  const normalized = normalizeProjectPath(path);
  return normalized !== null
    && /\.md(?:own)?$/i.test(normalized)
    && !normalized.split('/').some((segment) => segment === '.git' || segment === 'node_modules');
}
