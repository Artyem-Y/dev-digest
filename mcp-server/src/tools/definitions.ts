import { z } from 'zod';
import type { DevDigestApi } from '../http-client.js';
import { resolveRepository } from '../core/resolve-repository.js';
import { resolvePullLocator } from '../core/resolve-pull-locator.js';
import { runReviewAndWait } from '../core/run-review.js';

export const TOOL_DESCRIPTIONS = {
  devdigest_list_agents: 'List configured DevDigest review agents. Call before devdigest_run_agent_on_pr to get a valid agent ID; returns safe agent summaries only.',
  devdigest_run_agent_on_pr: 'Run one configured DevDigest agent on a pull request. Call after devdigest_list_agents when the user requests a review; waits for and returns the persisted terminal findings.',
  devdigest_get_findings: 'Get the latest review verdict and findings for a pull request, grouped by agent. Each review includes its findings nested inside. By default returns only the latest run per agent.',
  devdigest_get_conventions: 'Get accepted, evidence-backed conventions for a DevDigest repository. Call when the user asks for repository rules or review guidance; reads saved conventions and never starts extraction.',
  devdigest_get_blast_radius: 'Get the precomputed downstream-impact map for one pull request. Call when asked what a change can affect; reads the repository index and never starts a review.',
} as const;

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
type ToolHandler = (arguments_: Record<string, unknown>) => Promise<ToolResult>;
export interface ToolDefinition { name: keyof typeof TOOL_DESCRIPTIONS; title: string; description: string; inputSchema?: z.ZodRawShape; annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }; handler: ToolHandler; }

const repositorySchema = { repository: z.string().trim().min(1).max(300) };
const pullSchema = {
  repository: z.string().trim().min(1).max(300)
    .describe('Optional repository locator (owner/name, name, or GitHub URL). Required only when the PR number is ambiguous.').optional(),
  pr_number: z.number().int().positive().describe('Pull request number, for example 15.'),
};
const reviewSchema = {
  repository: z.string().trim().min(1).max(300)
    .describe('Optional repository locator (owner/name, name, or GitHub URL). Required only when the PR number is ambiguous.').optional(),
  pr_number: z.number().int().positive().describe('Pull request number, for example 15.'),
  agent_id: z.string().uuid().describe('Enabled DevDigest agent ID from devdigest_list_agents.'),
};
const findingsSchema = {
  pr_id: z.string().trim().min(1).max(300)
    .describe("Pull request: DevDigest's internal pr_id (UUID), the PR number (for example '#15' or '15'), or part of the PR title (for example 'cost tracking')."),
  repo: z.string().trim().min(1).max(300)
    .describe("Optional repository to search in when pr_id is a number or title: 'owner/name', just 'name' (for example 'ai-customer-support'), or the repo id.").optional(),
  all_runs: z.boolean().optional().describe('If true, return findings from all runs, not just the latest per agent.'),
};
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export function createToolDefinitions(
  api: DevDigestApi,
  options: { sleep?: (milliseconds: number) => Promise<void> } = {},
): ToolDefinition[] {
  return [
    { name: 'devdigest_list_agents', title: 'List DevDigest agents', description: TOOL_DESCRIPTIONS.devdigest_list_agents, annotations: readAnnotations, handler: async () => respond({ agents: (await api.listAgents()).slice(0, 50) }) },
    {
      name: 'devdigest_run_agent_on_pr', title: 'Run agent review', description: TOOL_DESCRIPTIONS.devdigest_run_agent_on_pr, inputSchema: reviewSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      handler: async (input) => guard(async () => {
        const args = z.object(reviewSchema).parse(input);
        const selected = (await api.listAgents()).find((agent) => agent.id === args.agent_id && agent.enabled);
        if (!selected) throw new Error(`Agent "${args.agent_id}" is unknown or disabled. Call devdigest_list_agents to choose an enabled agent ID.`);
        const pull = await resolvePullLocator(api, String(args.pr_number), args.repository);
        const result = await runReviewAndWait(api, pull.id, selected.id, options);
        if (result.status === 'failed' || result.status === 'cancelled') {
          throw new Error(`DevDigest review ${result.status}: ${result.error ?? 'no error detail'}. Correct the issue, then call devdigest_get_findings with pr_id ${args.pr_number}.`);
        }
        return result;
      }),
    },
    {
      name: 'devdigest_get_findings', title: 'Get review findings', description: TOOL_DESCRIPTIONS.devdigest_get_findings, inputSchema: findingsSchema, annotations: readAnnotations,
      handler: async (input) => guard(async () => {
        const args = z.object(findingsSchema).parse(input);
        const pull = await resolvePullLocator(api, args.pr_id, args.repo);
        const reviews = (await api.getPullReviews(pull.id)).filter((review) => review.kind === 'review' && review.agent_id);
        return formatPullFindings(pull.id, pull.repository?.full_name ?? null, reviews, args.all_runs === true);
      }),
    },
    {
      name: 'devdigest_get_conventions', title: 'Get repository conventions', description: TOOL_DESCRIPTIONS.devdigest_get_conventions, inputSchema: repositorySchema, annotations: readAnnotations,
      handler: async (input) => guard(async () => {
        const args = z.object(repositorySchema).parse(input);
        const repository = await resolveRepository(api, args.repository);
        const conventions = (await api.getConventions(repository.id)).filter((convention) => convention.status === 'accepted').slice(0, 20).map(({ rule, category, evidence_path, evidence_line, confidence }) => ({ rule, category, evidence_path, evidence_line, confidence }));
        return { repository: repository.full_name, conventions };
      }),
    },
    {
      name: 'devdigest_get_blast_radius', title: 'Get blast radius', description: TOOL_DESCRIPTIONS.devdigest_get_blast_radius, inputSchema: pullSchema, annotations: readAnnotations,
      handler: async (input) => guard(async () => {
        const args = z.object(pullSchema).parse(input);
        const pull = await resolvePullLocator(api, String(args.pr_number), args.repository);
        return api.getBlastRadius(pull.id);
      }),
    },
  ];
}

function formatPullFindings(
  pullId: string,
  repository: string | null,
  reviews: Awaited<ReturnType<DevDigestApi['getPullReviews']>>,
  allRuns: boolean,
) {
  const byAgent = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const agentId = review.agent_id!;
    byAgent.set(agentId, [...(byAgent.get(agentId) ?? []), review]);
  }
  const agents = [...byAgent.entries()].map(([agentId, agentReviews]) => {
    const ordered = agentReviews.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const selected = allRuns ? ordered : ordered.slice(0, 1);
    return {
      agent_id: agentId,
      agent_name: ordered[0]?.agent_name ?? null,
      reviews: selected.map((review) => ({
        id: review.id, run_id: review.run_id, verdict: review.verdict, summary: review.summary,
        score: review.score, created_at: review.created_at,
        findings: review.findings.slice(0, 20).map(compactFinding), findings_truncated: review.findings.length > 20,
      })),
    };
  });
  return { pr_id: pullId, repository, all_runs: allRuns, agents };
}

function compactFinding(finding: Awaited<ReturnType<DevDigestApi['getPullReviews']>>[number]['findings'][number]) {
  return {
    id: finding.id,
    severity: finding.severity,
    category: truncate(finding.category, 100),
    title: truncate(finding.title, 500),
    file: truncate(finding.file, 1_000),
    start_line: finding.start_line,
    end_line: finding.end_line,
    rationale: truncate(finding.rationale, 4_000),
    suggestion: finding.suggestion === null ? null : truncate(finding.suggestion, 4_000),
    confidence: finding.confidence,
    kind: truncate(finding.kind, 100),
  };
}

function truncate(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function respond(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}
async function guard(action: () => Promise<unknown>): Promise<ToolResult> { try { return respond(await action()); } catch (error) { return { isError: true, content: [{ type: 'text', text: (error as Error).message }] }; } }
