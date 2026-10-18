import { z } from 'zod';
import type { DevDigestApi } from '../http-client.js';
import { resolveRepository } from '../core/resolve-repository.js';
import { resolvePull } from '../core/resolve-pull.js';
import { runReviewAndWait } from '../core/run-review.js';

export const TOOL_DESCRIPTIONS = {
  devdigest_list_agents: 'List configured DevDigest review agents. Call before devdigest_run_agent_on_pr to get a valid agent ID; returns safe agent summaries only.',
  devdigest_run_agent_on_pr: 'Run one configured DevDigest agent on a pull request. Call after devdigest_list_agents when the user requests a review; waits up to 120 seconds and returns persisted findings or a run ID if still running.',
  devdigest_get_findings: 'Get the persisted structured result for one DevDigest review run. Call when the user asks for results of a known run or a previous review is still running.',
  devdigest_get_conventions: 'Get accepted, evidence-backed conventions for a DevDigest repository. Call when the user asks for repository rules or review guidance; reads saved conventions and never starts extraction.',
  devdigest_get_blast_radius: 'Get the precomputed downstream-impact map for one pull request. Call when asked what a change can affect; reads the repository index and never starts a review.',
} as const;

type ToolResult = { content: Array<{ type: 'text'; text: string }>; structuredContent?: Record<string, unknown>; isError?: boolean };
type ToolHandler = (arguments_: Record<string, unknown>) => Promise<ToolResult>;
export interface ToolDefinition { name: keyof typeof TOOL_DESCRIPTIONS; title: string; description: string; inputSchema?: z.ZodRawShape; annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }; handler: ToolHandler; }

const repositorySchema = { repository: z.string().trim().min(1).max(300) };
const pullSchema = { ...repositorySchema, pr_number: z.number().int().positive() };
const runSchema = { run_id: z.string().uuid() };
const reviewSchema = { ...pullSchema, agent_id: z.string().uuid() };
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export function createToolDefinitions(
  api: DevDigestApi,
  options: { maxWaitMs?: number; sleep?: (milliseconds: number) => Promise<void>; now?: () => number } = {},
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
        const repository = await resolveRepository(api, args.repository);
        const pull = await resolvePull(api, repository, args.pr_number);
        const result = await runReviewAndWait(api, pull.id, selected.id, options);
        if (result.status === 'failed' || result.status === 'cancelled') throw new Error(`DevDigest review ${result.status}: ${result.error ?? 'no error detail'}. Use devdigest_get_findings with run_id ${result.run_id} after correcting the issue.`);
        return result;
      }),
    },
    { name: 'devdigest_get_findings', title: 'Get review findings', description: TOOL_DESCRIPTIONS.devdigest_get_findings, inputSchema: runSchema, annotations: readAnnotations, handler: async (input) => guard(async () => api.getFindings(z.object(runSchema).parse(input).run_id)) },
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
        const repository = await resolveRepository(api, args.repository);
        const pull = await resolvePull(api, repository, args.pr_number);
        return api.getBlastRadius(pull.id);
      }),
    },
  ];
}

function respond(value: unknown): ToolResult {
  const structuredContent = Array.isArray(value)
    ? { items: value }
    : value !== null && typeof value === 'object'
      ? value as Record<string, unknown>
      : { result: value };
  return { structuredContent, content: [{ type: 'text', text: JSON.stringify(value) }] };
}
async function guard(action: () => Promise<unknown>): Promise<ToolResult> { try { return respond(await action()); } catch (error) { return { isError: true, content: [{ type: 'text', text: (error as Error).message }] }; } }
