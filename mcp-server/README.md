# DevDigest MCP server

`@devdigest/mcp-server` is a local stdio MCP process for the DevDigest API. It
does not open a network listener, access the database, or read DevDigest
secrets. It calls the already-running local API through `http://127.0.0.1:3001`
by default. `DEVDIGEST_API_URL` may override that only with an `http://`
loopback or localhost URL without credentials.

## Start and verify

Start DevDigest first from the repository root:

```sh
./scripts/dev.sh
```

Then, in another terminal:

```sh
cd mcp-server
pnpm install
pnpm test
pnpm typecheck
pnpm start
```

`pnpm start` speaks MCP JSON-RPC on stdout. Keep that terminal attached to an
MCP host; diagnostics are written to stderr.

The repository-local [`.mcp.json`](../.mcp.json) registers this process as
`devdigest-mcp` for Claude Code. It intentionally contains no GitHub MCP
configuration, credentials, or GitHub toolset grants. Restart Claude Code from
the repository after changing the file, then use `/mcp` to confirm the server
is connected.

## Inspector acceptance

With the API running, launch MCP Inspector from the repository root:

```sh
npx @modelcontextprotocol/inspector pnpm --dir mcp-server start
```

Verify that Inspector exposes exactly five tools, their input schemas, and
their annotations:

| Tool | Read only |
| --- | --- |
| `devdigest_list_agents` | yes |
| `devdigest_run_agent_on_pr` | no |
| `devdigest_get_findings` | yes |
| `devdigest_get_conventions` | yes |
| `devdigest_get_blast_radius` | yes |

The run tool starts exactly one enabled agent and blocks for at most 120
seconds. It returns persisted findings when terminal, or
`{ "status": "running", "run_id": "..." }` when its wait deadline expires.
`devdigest_get_blast_radius` reads the precomputed map from `GET /pulls/:id/blast`.
It never starts a review, rebuilds the repository index, or invokes a model.

## Locked tool descriptions

These descriptions are public MCP interface text and must remain verbatim.

| Tool | Description |
| --- | --- |
| `devdigest_list_agents` | List configured DevDigest review agents. Call before devdigest_run_agent_on_pr to get a valid agent ID; returns safe agent summaries only. |
| `devdigest_run_agent_on_pr` | Run one configured DevDigest agent on a pull request. Call after devdigest_list_agents when the user requests a review; waits up to 120 seconds and returns persisted findings or a run ID if still running. |
| `devdigest_get_findings` | Get the latest review verdict and findings for a pull request, grouped by agent. Each review includes its findings nested inside. By default returns only the latest run per agent. |
| `devdigest_get_conventions` | Get accepted, evidence-backed conventions for a DevDigest repository. Call when the user asks for repository rules or review guidance; reads saved conventions and never starts extraction. |
| `devdigest_get_blast_radius` | Get the precomputed downstream-impact map for one pull request. Call when asked what a change can affect; reads the repository index and never starts a review. |

## Claude Code acceptance

Against a seeded or otherwise known local PR, use this sequence:

1. Call `devdigest_list_agents` and select an enabled returned ID.
2. Call `devdigest_run_agent_on_pr` with a PR number and that one agent ID.
   `repository` is optional unless the PR number exists in more than one
   configured repository.
3. Call `devdigest_get_findings` with `pr_id`; optionally provide `repo` to
   disambiguate a PR number or title, and use `all_runs: true` for history.

The findings must be factual rows persisted by DevDigest, never an MCP-host
model guess. Each review includes at most 20 findings and reports
`findings_truncated` when more persisted findings exist.

## Reproducible token audit

Record the values reported by Claude Code, not estimates. Do this in a scratch
chat so normal work is not affected.

| State | Action to record |
| --- | --- |
| Baseline | Start Claude Code without MCP servers for the measurement, then run `/context`. |
| DevDigest only | Enable only project-local `devdigest-mcp`; run `/context` again and use `/mcp` to confirm one server and five tools. |
| Full GitHub MCP | Add your existing, user-managed GitHub MCP configuration outside this repository. Run `/mcp` and record its actual tool count, which varies by server version and active toolsets. Then run `/context`. |
| Tool Search disabled | Launch `ENABLE_TOOL_SEARCH=false claude`, repeat `/mcp` and `/context`, and record the schema-context increase. |
| Restricted GitHub MCP | Launch `GITHUB_TOOLSETS="repos,pull_requests" GITHUB_READ_ONLY=1 claude`, then record `/mcp` and `/context`. Keep GitHub credentials in the user-managed configuration, never in this repository. |
| Tool Search restored | Remove `ENABLE_TOOL_SEARCH` or launch `ENABLE_TOOL_SEARCH=true claude`; run `/context`, then invoke one real GitHub read tool and inspect its on-demand context appearance. |

Tool Search defers tool schemas until they are needed; it does not reduce what a
server is authorized to do. `GITHUB_READ_ONLY=1` is the deterministic security
control: it prevents write tools from registering at all. `GITHUB_TOOLSETS`
reduces the registered GitHub surface to the specified read toolsets.

Tool Search requires a model that supports `tool_reference` (Sonnet 4+ or Opus
4+; not Haiku). Proxy/Vertex deployments may have different defaults, the first
deferred call adds a lookup step, vague tool names can miss, and Tool Search
does not shrink large tool responses.
