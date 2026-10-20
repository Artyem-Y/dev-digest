/** Maximum persisted findings loaded for one MCP run result. */
export const MCP_RUN_FINDINGS_MAX = 20;

export type McpRunStatus = 'running' | 'done' | 'failed' | 'cancelled';

/** Application-owned persistence projection needed by the MCP run-result use case. */
export interface McpRunRecord {
  run: {
    id: string;
    status: string | null;
    error: string | null;
  };
  review: {
    verdict: string | null;
    summary: string | null;
    score: number | null;
  } | null;
  findings: McpRunFindingRecord[];
  severityCounts: McpSeverityCounts;
  findingsTruncated: boolean;
}

/** Aggregate all persisted findings, including findings outside the bounded list. */
export interface McpSeverityCounts {
  critical: number;
  warning: number;
  suggestion: number;
}

export interface McpRunFindingRecord {
  id: string;
  severity: string;
  category: string;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  rationale: string;
  suggestion: string | null;
  confidence: number;
  kind: string | null;
}

export interface McpRunResult {
  runId: string;
  status: McpRunStatus;
  error: string | null;
  verdict: string | null;
  summary: string | null;
  score: number | null;
  findings: McpRunFindingRecord[];
  severityCounts: McpSeverityCounts;
  findingsTruncated: boolean;
}

/** Map one persisted run to a bounded application result without exposing its trace. */
export function toMcpRunResult(record: McpRunRecord): McpRunResult {
  return {
    runId: record.run.id,
    status: mcpRunStatus(record.run.status),
    error: record.run.error ? bounded(record.run.error, 4_000) : null,
    verdict: record.review?.verdict ?? null,
    summary: record.review?.summary ? bounded(record.review.summary, 4_000) : null,
    score: record.review?.score ?? null,
    severityCounts: record.severityCounts,
    findingsTruncated: record.findingsTruncated,
    findings: record.findings.slice(0, MCP_RUN_FINDINGS_MAX).map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      category: finding.category,
      title: bounded(finding.title, 500),
      file: bounded(finding.file, 1_000),
      startLine: finding.startLine,
      endLine: finding.endLine,
      rationale: bounded(finding.rationale, 4_000),
      suggestion: finding.suggestion ? bounded(finding.suggestion, 4_000) : null,
      confidence: finding.confidence,
      kind: finding.kind ?? 'finding',
    })),
  };
}

function mcpRunStatus(status: string | null): McpRunStatus {
  if (status === 'running' || status === 'done' || status === 'failed' || status === 'cancelled') {
    return status;
  }
  throw new Error(`Unsupported agent run status: ${status ?? 'null'}`);
}

function bounded(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}
