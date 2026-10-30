import { expect, it } from 'vitest';
import { filterOnboardingOutput } from '../src/modules/onboarding/domain/filter-output.js';

it('accepts an exact documented architecture statement but rejects invented additions', () => {
  const fact = { id: 'doc', kind: 'documentation' as const, value: 'The API handles repository indexing.' };
  const sections = [{ id: 'architecture' as const, claims: [], narrative: [
    { text: fact.value, fact_ids: ['doc'] },
    { text: 'The API handles repository indexing and payments.', fact_ids: ['doc'] },
  ] }];
  expect(filterOnboardingOutput({ sections }, [fact])[0]?.narrative).toEqual([{ text: fact.value, fact_ids: ['doc'] }]);
});

it('accepts only section-compatible templates with captured facts', () => {
  const facts = [{ id: 'p', kind: 'path' as const, value: 'src/a.ts' }, { id: 'c', kind: 'command' as const, value: 'npm run test' }];
  const output = { sections: [
    { id: 'architecture' as const, claims: [{ fact_id: 'missing', template: 'describe' as const }] },
    { id: 'critical_paths' as const, claims: [{ fact_id: 'c', template: 'run' as const }] },
    { id: 'local_run' as const, claims: [{ fact_id: 'c', template: 'run' as const }] },
    { id: 'reading_path' as const, claims: [{ fact_id: 'p', template: 'read' as const }] },
    { id: 'first_tasks' as const, claims: [{ fact_id: 'p', template: 'suggest' as const }] },
  ] } as const;
  const sections = filterOnboardingOutput(output, facts);
  expect(sections[0].items).toEqual([]);
  expect(sections[1].items).toEqual([]);
  expect(sections[2].items[0]?.text).toBe('npm run test');
  expect(sections[3].items[0]?.text).toBe('src/a.ts');
  expect(sections[4].items[0]?.text).toBe('Suggestion: explore src/a.ts');
});

it('drops unsafe captured content that could become a link, command, HTML or invented assertion', () => {
  const facts = ['<script>x</script>', 'https://bad.example', '../secrets', 'file.ts; rm -rf /'].map((value, i) => ({ id: `p${i}`, kind: 'path' as const, value }));
  const output = { sections: [
    { id: 'architecture' as const, claims: [] }, { id: 'critical_paths' as const, claims: [] }, { id: 'local_run' as const, claims: [] },
    { id: 'reading_path' as const, claims: facts.map((f) => ({ fact_id: f.id, template: 'read' as const })) },
    { id: 'first_tasks' as const, claims: [] },
  ] } as const;
  expect(filterOnboardingOutput(output, facts)[3].items).toEqual([]);
});

it('keeps model-written supported sentences and drops invented, markup and mismatched claims', () => {
  const facts = [{ id: 'edge', kind: 'dependency' as const, value: 'src/app.ts -> src/db.ts' }, { id: 'stack', kind: 'stack' as const, value: 'Go (go.mod)' }];
  const output = { sections: [
    { id: 'architecture' as const, claims: [], narrative: [
      { text: 'The repository uses Go (go.mod).', fact_ids: ['stack'] },
      { text: 'src/app.ts imports src/db.ts.', fact_ids: ['edge'] },
      { text: 'The repository uses Go (go.mod) for payments.', fact_ids: ['stack'] },
      { text: '<b>The repository uses Go (go.mod).</b>', fact_ids: ['stack'] },
      { text: 'src/app.ts imports src/db.ts.', fact_ids: ['stack'] },
    ] },
    { id: 'critical_paths' as const, claims: [], narrative: [] }, { id: 'local_run' as const, claims: [], narrative: [] },
    { id: 'reading_path' as const, claims: [], narrative: [] }, { id: 'first_tasks' as const, claims: [], narrative: [] },
  ] };
  expect(filterOnboardingOutput(output, facts)[0]?.narrative).toEqual([{ text: 'The repository uses Go (go.mod).', fact_ids: ['stack'] }, { text: 'src/app.ts imports src/db.ts.', fact_ids: ['edge'] }]);
});

it('accepts connected supported clauses only when every cited fact is used and every clause is evidenced', () => {
  const facts = [{ id: 'stack', kind: 'stack' as const, value: 'Go (go.mod)' }, { id: 'edge', kind: 'dependency' as const, value: 'src/app.ts -> src/db.ts' }];
  const text = 'The repository uses Go (go.mod), and src/app.ts imports src/db.ts.';
  const output = { sections: [{ id: 'architecture' as const, claims: [], narrative: [
    { text, fact_ids: ['stack', 'edge'] },
    { text: 'The repository uses Go (go.mod), and src/app.ts imports src/db.ts for payments.', fact_ids: ['stack', 'edge'] },
    { text, fact_ids: ['stack'] },
    { text: 'The repository uses Go (go.mod).', fact_ids: ['stack', 'edge'] },
  ] }] };
  expect(filterOnboardingOutput(output, facts)[0]?.narrative).toEqual([{ text, fact_ids: ['stack', 'edge'] }]);
});
