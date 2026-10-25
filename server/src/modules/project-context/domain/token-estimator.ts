/** Deliberately provider-independent approximate token estimate for UI/budgeting. */
export function estimateProjectDocumentTokens(content: string): number {
  return Math.ceil(content.length / 4);
}
