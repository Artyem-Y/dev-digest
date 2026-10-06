/**
 * Reject prompt-injection patterns in skills before they can be added to an
 * agent prompt. This deliberately requires multiple independent signals to
 * avoid classifying ordinary review guidance as unsafe.
 */
export function isUnsafeSkillContent(content: string): boolean {
  const normalized = content.toLowerCase().replace(/\s+/g, " ");
  const overridesInstructions = /\b(ignore|disregard|override)\b.{0,80}\b(previous|all)\b.{0,80}\b(instruction|rule|guideline|safety)\b/.test(normalized);
  const systemOverride = /\bsystem\s*:\s*(override|ignore|disable)\b/.test(normalized);
  const requestsPromptDisclosure = /\b(output|reveal|show|print)\b.{0,80}\b(system prompt|agent configuration)\b/.test(normalized);
  const manipulatesReview = /\bapprove all pr(?:s)?\b|\bnever (?:flag|mention)\b.{0,50}\b(security|vulnerabilit)\b|\balways\b.{0,50}\b(score\s*[:=]?\s*100|return score)\b/.test(normalized);

  return (overridesInstructions || systemOverride) && (requestsPromptDisclosure || manipulatesReview);
}
