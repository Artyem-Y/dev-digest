/** Return a same-repository issue number only for an explicit closing reference. */
export function closingIssueNumber(body: string | null | undefined): number | undefined {
  const match = body?.match(/\b(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s*:?\s*#(\d+)\b/i);
  const value = Number(match?.[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
