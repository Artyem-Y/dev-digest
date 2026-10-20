import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TOOL_DESCRIPTIONS, createToolDefinitions } from '../src/tools/definitions.js';

describe('DevDigest MCP tool contracts', () => {
  it('registers exactly the five implementation-locked tools', () => {
    const definitions = createToolDefinitions({} as never);

    expect(definitions.map((definition) => definition.name)).toEqual([
      'devdigest_list_agents',
      'devdigest_run_agent_on_pr',
      'devdigest_get_findings',
      'devdigest_get_conventions',
      'devdigest_get_blast_radius',
    ]);
    expect(TOOL_DESCRIPTIONS).toEqual({
      devdigest_list_agents:
        'List configured DevDigest review agents. Call before devdigest_run_agent_on_pr to get a valid agent ID; returns only id, name, description, model, and enabled.',
      devdigest_run_agent_on_pr:
        'Run one configured DevDigest agent on a pull request. Call after devdigest_list_agents when the user requests a review; waits up to 10 minutes for persisted findings, then returns the run ID if still running.',
      devdigest_get_findings:
        'Get persisted review results for a pull request. Returns reviews with nested findings and total_findings; by default includes only the latest run per agent.',
      devdigest_get_conventions:
        'Get accepted, evidence-backed conventions for a DevDigest repository. Call when the user asks for repository rules or review guidance; reads saved conventions and never starts extraction.',
      devdigest_get_blast_radius:
        'Get the precomputed downstream-impact map for one pull request. Call when asked what a change can affect; reads the repository index and never starts a review.',
    });
  });

  it('keeps repository optional for the run tool and exposes the requested findings inputs', () => {
    const definitions = createToolDefinitions({} as never);
    const run = definitions.find((definition) => definition.name === 'devdigest_run_agent_on_pr')!;
    const blast = definitions.find((definition) => definition.name === 'devdigest_get_blast_radius')!;
    const findings = definitions.find((definition) => definition.name === 'devdigest_get_findings')!;

    expect(z.object(run.inputSchema!).safeParse({
      pr_number: 15, agent_id: '00000000-0000-0000-0000-000000000001',
    }).success).toBe(true);
    expect(z.object(blast.inputSchema!).safeParse({ pr_number: 15 }).success).toBe(true);
    expect(z.object(findings.inputSchema!).safeParse({ pr_id: '#15' }).success).toBe(true);
    expect(z.object(findings.inputSchema!).safeParse({}).success).toBe(false);
  });
});
