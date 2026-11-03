/** Conservative indicators only: this is not an exhaustive secret scanner. */
export function containsLikelySecret(text: string): boolean {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(text)
    || /\b(?:sk_live_|sk-proj-|ghp_|github_pat_|xox[baprs]-|AKIA)[A-Za-z0-9_\-]{12,}/.test(text)
    || /\b(?:api[_-]?key|secret|password|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["'][^"'\s]{12,}["']/i.test(text);
}
