import type { LLMProvider, StructuredRequest, StructuredResult } from '@devdigest/shared';

/** Only used by the isolated test server, with a pre-existing hermetic attestation. */
export function createE2EOnboardingFixture(fallback: LLMProvider): LLMProvider {
  let calls = 0;
  return {
    ...fallback,
    id: 'openrouter',
    listModels: () => fallback.listModels(),
    complete: (request) => fallback.complete(request),
    embed: (texts) => fallback.embed(texts),
    async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
      if (req.schemaName !== 'OnboardingTour') return fallback.completeStructured(req);
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (calls > 1) throw new Error('fixture failure');
      const body = req.messages.find((m) => m.role === 'user')?.content ?? '';
      const json = body.match(/<untrusted[^>]*>\n([\s\S]*)\n<\/untrusted>/)?.[1];
      const facts = JSON.parse(json ?? '[]') as Array<{ id: string; kind: string; value: string }>;
      const path = facts.find((f) => f.kind === 'path' && f.value === 'src/main.ts');
      const command = facts.find((f) => f.kind === 'command');
      const dependency = facts.find((f) => f.kind === 'dependency' && f.value.includes(' -> '));
      if (!path || !command || !dependency) throw new Error('fixture facts missing');
      const raw = { sections: [
        { id: 'architecture', claims: [{ fact_id: dependency.id, template: 'describe' }], narrative: [{ text: `${dependency.value.replace(' -> ', ' imports ')}.`, fact_ids: [dependency.id] }] },
        { id: 'critical_paths', claims: [{ fact_id: dependency.id, template: 'describe' }], narrative: [] },
        { id: 'local_run', claims: [{ fact_id: command.id, template: 'run' }], narrative: [] },
        { id: 'reading_path', claims: [{ fact_id: path.id, template: 'read' }], narrative: [] },
        { id: 'first_tasks', claims: [{ fact_id: path.id, template: 'suggest' }], narrative: [] },
      ] };
      return { data: req.schema.parse(raw), model: req.model, tokensIn: 100, tokensOut: 20, costUsd: 0.001, raw: '', attempts: 1,
        reportedUsage: { inputTokens: 100, outputTokens: 20, costUsd: 0.001 } };
    },
  };
}
