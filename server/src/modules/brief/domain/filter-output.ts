import { Brief, RepositoryRelativePath } from '@devdigest/shared';
import { z } from 'zod';

// Provider output is untrusted: permit it just long enough to remove unsafe or
// ungrounded paths, then parse the persisted result with the strict shared schema.
const Candidate = z.object({
  summary: z.string().min(1),
  risks: z.object({ risks: z.array(z.object({ kind: z.string(), title: z.string(), explanation: z.string(), severity: z.enum(['high', 'medium', 'low']), file_refs: z.array(z.string()) })) }),
  review_focus: z.array(z.object({ file: z.string(), line: z.number().int(), reason: z.string().min(1) })),
});

/** Ground provider output before persistence; paths must be exact evidence matches. */
export function filterBriefOutput(candidate: unknown, changedPaths: readonly string[], blastPaths: readonly string[], headSha: string) {
  const parsed = Candidate.parse(candidate);
  const changed = new Set(changedPaths);
  const riskPaths = new Set([...changedPaths, ...blastPaths]);
  return Brief.parse({
    summary: parsed.summary,
    head_sha: headSha,
    intent: { intent: '', in_scope: [], out_of_scope: [] },
    blast: { changed_symbols: [], downstream: [], summary: '', degraded: true, reason: 'no_data', prior_prs: null },
    history: { history: [] },
    risks: { risks: parsed.risks.risks
      .map((risk) => ({ ...risk, file_refs: risk.file_refs.filter((file) => riskPaths.has(file) && RepositoryRelativePath.safeParse(file).success) }))
      .filter((risk) => risk.file_refs.length > 0) },
    review_focus: parsed.review_focus.filter((focus) => changed.has(focus.file) && RepositoryRelativePath.safeParse(focus.file).success && focus.line > 0),
  });
}
