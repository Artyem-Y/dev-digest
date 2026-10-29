import type { OnboardingFact } from './facts.js';

type SectionId = 'architecture' | 'critical_paths' | 'local_run' | 'reading_path' | 'first_tasks';
type Template = 'describe' | 'read' | 'run' | 'suggest';
export interface ModelSections { readonly sections: readonly { readonly id: SectionId; readonly claims: readonly { readonly fact_id: string; readonly template: Template }[]; readonly narrative?: readonly { readonly text: string; readonly fact_ids: readonly string[] }[] }[] }
export interface GroundedItem { kind: 'observation' | 'path' | 'command' | 'route' | 'dependency' | 'suggestion'; text: string; fact_ids: string[] }
export interface GroundedSection { id: SectionId; items: GroundedItem[]; narrative: Array<{ text: string; fact_ids: string[] }>; unavailable_reason: string | null }
const safePath = (v: string) => /^(?!\/)(?!.*(?:^|\/)\.\.?($|\/))[A-Za-z0-9_./@+-]+$/.test(v);
export const safeOnboardingFact = (f: OnboardingFact) => {
  if (f.kind === 'path') return safePath(f.value);
  if (f.kind === 'command') return /^(?:(?:cd [A-Za-z0-9_-]+ && )?npm run [A-Za-z0-9:_-]+|make [A-Za-z0-9_][A-Za-z0-9_.-]*)$/.test(f.value);
  if (f.kind === 'critical_path') { const paths = f.value.split(' -> '); return paths.length >= 2 && paths.length <= 4 && paths.every(safePath); }
  if (f.kind === 'stack') return f.value === 'Node.js (package.json)' || f.value === 'Go (go.mod)';
  if (f.kind === 'dependency') return /^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/.test(f.value) || f.value.split(' -> ').length === 2 && f.value.split(' -> ').every(safePath);
  if (f.kind === 'route') return /^[A-Z]+ \/[A-Za-z0-9_/:{}.*-]* \([A-Za-z0-9_./@+-]+\)$/.test(f.value);
  if (f.kind === 'documentation') return f.value.length <= 300 && /^[A-Za-z][A-Za-z0-9 ,():+/-]*\.$/.test(f.value);
  if (f.kind === 'architecture_edge') return /^[A-Za-z0-9_@/ .()+-]{1,60} -> [A-Za-z0-9_@/ .()+-]{1,60}$/.test(f.value);
  return /^TODO at [A-Za-z0-9_./@+-]+:[1-9][0-9]*$/.test(f.value);
};

/** Accept model-written sentences only when their complete text follows a fact-specific grammar. */
function supportedSentences(section: SectionId, fact: OnboardingFact): string[] {
  if (!safeOnboardingFact(fact)) return [];
  if (section === 'architecture' && fact.kind === 'documentation') return [fact.value];
  if (section === 'architecture' && fact.kind === 'stack') return [`The repository uses ${fact.value}.`, `${fact.value} is used in this repository.`];
  if (section === 'architecture' && fact.kind === 'dependency' && !fact.value.includes(' -> ')) return [`The repository depends on ${fact.value}.`];
  if ((section === 'architecture' || section === 'critical_paths') && (fact.kind === 'dependency' || fact.kind === 'critical_path')) {
    const paths = fact.value.split(' -> ');
    return paths.slice(0, -1).flatMap((from, index) => [`${from} imports ${paths[index + 1]}.`, `${paths[index + 1]} is imported by ${from}.`]);
  }
  if (section === 'local_run' && fact.kind === 'command') return [`Run ${fact.value}.`, `The repository defines ${fact.value}.`];
  if (section === 'reading_path' && fact.kind === 'path') return [`Read ${fact.value}.`, `Start with ${fact.value}.`];
  if (section === 'first_tasks' && fact.kind === 'path') return [`Consider exploring ${fact.value}.`, `Explore ${fact.value} as a first task.`];
  return [];
}

/** Only accept grounded grammar and exact typed evidence; unsupported text is dropped. */
export function filterOnboardingOutput(output: ModelSections, facts: readonly OnboardingFact[]): GroundedSection[] {
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  return output.sections.map((section) => {
    const items: GroundedItem[] = [];
    for (const claim of section.claims) {
      const fact = byId.get(claim.fact_id);
      if (!fact || !safeOnboardingFact(fact)) continue;
      if (section.id === 'local_run' && claim.template === 'run' && fact.kind === 'command') items.push({ kind: 'command', text: fact.value, fact_ids: [fact.id] });
      else if (section.id === 'reading_path' && claim.template === 'read' && fact.kind === 'path') items.push({ kind: 'path', text: fact.value, fact_ids: [fact.id] });
      else if (section.id === 'first_tasks' && claim.template === 'suggest' && fact.kind === 'path') items.push({ kind: 'suggestion', text: `Suggestion: explore ${fact.value}`, fact_ids: [fact.id] });
      else if ((section.id === 'architecture' || section.id === 'critical_paths') && claim.template === 'describe' && (fact.kind === 'dependency' || fact.kind === 'critical_path' || fact.kind === 'stack')) items.push({ kind: 'dependency', text: fact.value, fact_ids: [fact.id] });
    }
    const narrative = (section.narrative ?? []).flatMap((sentence) => {
      if (!sentence.text.endsWith('.') || sentence.fact_ids.length === 0 || sentence.fact_ids.length > 3 || new Set(sentence.fact_ids).size !== sentence.fact_ids.length) return [];
      const clauses = sentence.text.slice(0, -1).split(/, and |; /);
      const used = new Set<string>();
      for (const clause of clauses) {
        const id = sentence.fact_ids.find((id) => { const fact = byId.get(id); return fact && supportedSentences(section.id, fact).includes(`${clause}.`); });
        if (!id) return [];
        used.add(id);
      }
      if (used.size !== sentence.fact_ids.length) return [];
      return [{ text: sentence.text, fact_ids: [...sentence.fact_ids] }];
    });
    return { id: section.id, items, narrative, unavailable_reason: items.length || narrative.length ? null : 'No supported narrative available' };
  });
}
