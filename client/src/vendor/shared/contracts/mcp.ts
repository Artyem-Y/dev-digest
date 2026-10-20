import { z } from 'zod';
import { FindingCategory, FindingKind, Severity, Verdict } from './findings.js';
import { Provider } from './knowledge.js';

/** Maximum number of persisted findings exposed in one MCP run result. */
export const MCP_MAX_FINDINGS = 20;

/** Safe, compact agent projection for local MCP clients. */
export const McpAgentSummary = z.object({
  id: z.string().uuid(),
  name: z.string().max(500),
  description: z.string().max(1_000),
  enabled: z.boolean(),
  provider: Provider,
  model: z.string().max(500),
  version: z.number().int().positive(),
});
export type McpAgentSummary = z.infer<typeof McpAgentSummary>;

/** A bounded, persisted finding safe to return through an MCP tool. */
export const McpRunFinding = z.object({
  id: z.string().uuid(),
  severity: Severity,
  category: FindingCategory,
  title: z.string().max(500),
  file: z.string().max(1_000),
  start_line: z.number().int().positive(),
  end_line: z.number().int().positive(),
  rationale: z.string().max(4_000),
  suggestion: z.string().max(4_000).nullable(),
  confidence: z.number().min(0).max(1),
  kind: FindingKind,
});
export type McpRunFinding = z.infer<typeof McpRunFinding>;

/** Workspace-scoped persisted result for precisely one DevDigest agent run. */
export const McpRunFindings = z.object({
  run_id: z.string().uuid(),
  status: z.enum(['running', 'done', 'failed', 'cancelled']),
  error: z.string().max(4_000).nullable(),
  verdict: Verdict.nullable(),
  summary: z.string().max(4_000).nullable(),
  score: z.number().int().min(0).max(100).nullable(),
  severity_counts: z.object({
    critical: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    suggestion: z.number().int().nonnegative(),
  }),
  findings_truncated: z.boolean(),
  findings: z.array(McpRunFinding).max(MCP_MAX_FINDINGS),
});
export type McpRunFindings = z.infer<typeof McpRunFindings>;
