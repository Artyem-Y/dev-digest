import { describe, expect, it } from 'vitest';
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
        'List configured DevDigest review agents. Call before devdigest_run_agent_on_pr to get a valid agent ID; returns safe agent summaries only.',
      devdigest_run_agent_on_pr:
        'Run one configured DevDigest agent on a pull request. Call after devdigest_list_agents when the user requests a review; waits up to 120 seconds and returns persisted findings or a run ID if still running.',
      devdigest_get_findings:
        'Get the persisted structured result for one DevDigest review run. Call when the user asks for results of a known run or a previous review is still running.',
      devdigest_get_conventions:
        'Get accepted, evidence-backed conventions for a DevDigest repository. Call when the user asks for repository rules or review guidance; reads saved conventions and never starts extraction.',
      devdigest_get_blast_radius:
        'Get the precomputed downstream-impact map for one pull request. Call when asked what a change can affect; reads the repository index and never starts a review.',
    });
  });
});
