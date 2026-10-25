export interface BudgetItem { path?: string; content: string; estimatedTokens: number }
export interface BudgetSelection<F extends BudgetItem, S extends BudgetItem> { facts: F[]; specs: S[]; omitted: Array<F | S>; total: number }

export const BRIEF_TOKEN_LIMIT = 8_000;
export const FACTS_TOKEN_LIMIT = 4_000;
export const SPEC_TOKEN_LIMIT = 2_000;
/** Canonical prompt fitting accounts for all renderer overhead after deterministic selection. */
export const CONTENT_TOKEN_LIMIT = BRIEF_TOKEN_LIMIT;
export const MAX_PROJECT_DOCUMENTS = 20;

/** Facts reserve up to 4k; unused reservation flows to specs in lexical path order. */
export function selectBriefBudget<F extends BudgetItem, S extends BudgetItem>(facts: F[], specs: S[]): BudgetSelection<F, S> {
  let factUsed = 0;
  const keptFacts: F[] = [];
  const omitted: Array<F | S> = [];
  for (const fact of facts) {
    const actual = Math.ceil(fact.content.length / 4);
    const amount = Math.min(actual, FACTS_TOKEN_LIMIT - factUsed);
    if (amount <= 0) { omitted.push(fact); continue; }
    keptFacts.push({ ...fact, content: fact.content.slice(0, amount * 4), estimatedTokens: amount }); factUsed += amount;
  }
  let remaining = CONTENT_TOKEN_LIMIT - factUsed;
  const keptSpecs: S[] = [];
  for (const spec of [...specs].sort((a, b) => (a.path ?? '').localeCompare(b.path ?? ''))) {
    if (keptSpecs.length >= MAX_PROJECT_DOCUMENTS) { omitted.push(spec); continue; }
    const amount = Math.min(Math.ceil(spec.content.length / 4), SPEC_TOKEN_LIMIT, remaining);
    if (amount > remaining) { omitted.push(spec); continue; }
    if (amount <= 0) { omitted.push(spec); continue; }
    keptSpecs.push({ ...spec, content: spec.content.slice(0, amount * 4), estimatedTokens: amount }); remaining -= amount;
  }
  return { facts: keptFacts, specs: keptSpecs, omitted, total: BRIEF_TOKEN_LIMIT - remaining };
}
