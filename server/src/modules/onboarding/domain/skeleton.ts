import type { OnboardingTourSections } from '../../../vendor/shared/contracts/onboarding-tour.js';
import type { OnboardingFact, OnboardingFile } from './facts.js';

/** Empty sections remain visible when the necessary evidence was unavailable. */
export function buildOnboardingSkeleton(facts: OnboardingFact[], files: OnboardingFile[] = []): OnboardingTourSections {
  const commands = facts.filter((f) => f.kind === 'command').map((f) => ({ kind: 'command' as const, text: f.value, fact_ids: [f.id] }));
  const dependencies = facts.filter((f) => f.kind === 'dependency').map((f) => ({ kind: 'dependency' as const, text: f.value, fact_ids: [f.id] }));
  const architecture = facts.filter((f) => f.kind === 'architecture_edge').map((f) => ({ kind: 'dependency' as const, text: f.value, fact_ids: [f.id] }));
  const ranks = new Map(files.map((file, index) => [file.path, index]));
  const critical = facts.filter((f) => f.kind === 'critical_path').sort((a, b) => (ranks.get(a.value.split(' -> ')[0]!) ?? Infinity) - (ranks.get(b.value.split(' -> ')[0]!) ?? Infinity) || a.value.localeCompare(b.value)).map((f) => ({ kind: 'dependency' as const, text: f.value, fact_ids: [f.id] }));
  const todos = facts.filter((f) => f.kind === 'observation' && f.id.startsWith('todo:')).map((f) => ({ kind: 'observation' as const, text: f.value, fact_ids: [f.id] }));
  const pathFacts = new Map(facts.filter((f) => f.kind === 'path').map((f) => [f.value, f]));
  const reading = files.flatMap((f) => { const fact = pathFacts.get(f.path); return fact ? [{ kind: 'path' as const, text: f.path, fact_ids: [fact.id] }] : []; });
  const firstPath = reading[0];
  const traceTasks = critical.slice(0, 3).map((item) => { const [from, to] = item.text.split(' -> '); return { kind: 'suggestion' as const, text: `Suggestion: trace how ${from} uses ${to} and identify the relevant tests.`, fact_ids: item.fact_ids }; });
  const suggestions = traceTasks.length ? traceTasks : firstPath ? [{ kind: 'suggestion' as const, text: `Suggestion: explore ${firstPath.text}`, fact_ids: firstPath.fact_ids }] : [];
  const tasks = [...todos, ...suggestions];
  return [
    { id: 'architecture', items: architecture.length ? architecture : dependencies, unavailable_reason: architecture.length || dependencies.length ? null : 'Architecture evidence unavailable' },
    { id: 'critical_paths', items: critical, unavailable_reason: critical.length ? null : 'Dependency paths unavailable' },
    { id: 'local_run', items: commands, unavailable_reason: commands.length ? null : 'Local commands unavailable' },
    { id: 'reading_path', items: reading, unavailable_reason: reading.length ? null : 'Reading path unavailable' },
    { id: 'first_tasks', items: tasks, unavailable_reason: tasks.length ? null : 'Task evidence unavailable' },
  ];
}
