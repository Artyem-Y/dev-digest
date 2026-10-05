# Engineering Insights — Server

This is an append-only log of non-obvious, reusable backend knowledge. Read it before changing `server/` and re-read it before finishing.

Do not rewrite, reorder, or delete existing entries. Use the project `engineering-insights` skill and its append helper. If an entry becomes outdated, append a new entry that names the earlier insight it supersedes.

Each entry contains a stable ID, date, category, evidence, implication, and concise insight. Routine task history and README summaries do not belong here.

## Insights

<!-- insight-id: eng-server-1ed55eb1b49c -->
## eng-server-1ed55eb1b49c — Restoring agent run cost requires a forward migration

- Date: 2026-09-18
- Category: migration
- Evidence: server/src/db/migrations/0000_init.sql created agent_runs.cost_usd, 0009_complex_runaways.sql dropped it, and the current runs schema omits it.
- Implication: Restore the column in the current schema and a newly generated migration; editing either historical migration creates schema-history drift.

The agent run cost column has already completed a create-and-drop lifecycle, so any restoration must move the migration chain forward.

<!-- insight-id: eng-server-8fdc992788b8 -->
## eng-server-8fdc992788b8 — Reviewer core is the run-cost authority

- Date: 2026-09-18
- Category: boundary
- Evidence: reviewer-core/src/review/run.ts aggregates nullable provider costUsd, while server/src/modules/reviews/run-executor.ts destructures only tokensIn, tokensOut, and grounding and completeAgentRun has no cost field.
- Implication: Persist and expose outcome.costUsd; do not recompute price from token counts in the server or client.

Cost is already calculated at the provider/reviewer boundary and is currently discarded at server persistence, so downstream layers should transport the nullable result unchanged.

<!-- insight-id: eng-server-de37c610398b -->
## eng-server-de37c610398b — A cost-only migration cannot support review-batch aggregation

- Date: 2026-10-01
- Category: decision
- Evidence: Migration 0010_fair_pixie.sql restores only agent_runs.cost_usd; server/src/modules/pulls/routes.ts selects the newest terminal agent_runs row; server/test/reviews.it.test.ts proves a newer failed run returns null rather than an older run cost.
- Implication: Do not sum or label a PR-list value as one multi-agent review unless a persisted action-to-run relationship is introduced in a separately approved schema change.

Cost belongs to an individual agent run in the current schema. Timestamp grouping is not a reliable replacement for review-action identity, so the PR list must expose the latest terminal run's nullable cost.

<!-- insight-id: eng-server-98d738a4ab99 -->
## eng-server-98d738a4ab99 — Unset model tuning must be omitted rather than defaulted by the adapter

- Date: 2026-10-01
- Category: boundary
- Evidence: server/src/adapters/llm/openai.ts now builds tuning params only when temperature is defined; server/test/openai-provider.test.ts captures a structured request without temperature.
- Implication: Do not inject a sampling default into optional provider parameters, because models that support only provider defaults reject an explicit value.

The OpenAI provider contract distinguishes an absent temperature from a numeric temperature. Preserving absence lets model-specific defaults apply and avoids unsupported-temperature errors during structured review.

<!-- insight-id: eng-server-631c2ec2a32b -->
## eng-server-631c2ec2a32b — Select one latest terminal run per PR in SQL

- Date: 2026-10-01
- Category: performance
- Evidence: server/src/modules/pulls/routes.ts uses PostgreSQL DISTINCT ON agent_runs.pr_id with pr_id, ran_at DESC, id DESC ordering; server/test/reviews.it.test.ts verifies the latest terminal-run cost contract.
- Implication: For page-scoped PR lists, let PostgreSQL discard older terminal runs before transfer rather than sorting all histories and retaining the first row in application code. Any index for this query needs separate migration approval.

DISTINCT ON returns the latest terminal run per PR while preserving the nullable cost contract and avoids work proportional to total run history.

<!-- insight-id: eng-server-4d60861b80f1 -->
## eng-server-4d60861b80f1 — Direct OpenAI run cost requires an explicit model-price entry

- Date: 2026-10-01
- Category: boundary
- Evidence: OpenAI Chat Completions usage records tokens but not USD cost; completed gpt-6-luna runs stored null until server/src/adapters/llm/pricing.ts added the verified standard 0.10 input and 0.50 output USD-per-million rates. server/test/adapters.test.ts covers the estimate.
- Implication: When an OpenAI model becomes selectable, add and test its current standard token rates before expecting a numeric run cost. Preserve null for models whose price is unknown rather than displaying zero.

For direct OpenAI providers, cost persistence is only as complete as the local pricing coverage because the response supplies token usage, not billed USD.

<!-- insight-id: eng-server-b992542cbfb3 -->
## eng-server-b992542cbfb3 — PR findings must use each agent’s latest review

- Date: 2026-10-02
- Category: invariant
- Evidence: server/src/modules/pulls/routes.ts selects review rows newest-first, selectLatestReviewIdsPerAgent keeps one row for every PR and agent, and server/test/pulls-status.test.ts plus test/reviews.it.test.ts cover selection and API counts.
- Implication: When changing list-level findings, select current reviews per agent before counting; do not use only the PR’s single newest review or include superseded runs.

A PR may have current results from several reviewers and repeated runs from one reviewer. The list count is the union of the most recent persisted review for each agent, preserving all current agents while avoiding duplicate findings from reruns.

<!-- insight-id: eng-server-451f7ae29522 -->
## eng-server-451f7ae29522 — Onion Architecture is a target state, not the current server baseline

- Date: 2026-10-05
- Category: architecture
- Evidence: server/src/modules/pulls/routes.ts, settings/routes.ts, polling/routes.ts, and workspace/routes.ts import Drizzle or call container.db directly, while repos/routes.ts and agents/routes.ts delegate to services and repositories.
- Implication: For Onion Architecture work, enforce inward dependencies in new or substantially changed paths and do not report the server as fully migrated until the direct route-to-Drizzle paths are separately refactored.

The server uses mixed module shapes: some routes are thin adapters over services, while others couple transport directly to persistence. A big-bang folder rewrite would obscure feature changes, so the safe migration boundary is the touched path plus an explicit legacy exception.

<!-- insight-id: eng-server-4e39d8ac5114 -->
## eng-server-4e39d8ac5114 — Module factories keep HTTP routes free of persistence composition

- Date: 2026-10-02
- Category: architecture
- Evidence: Supersedes eng-server-451f7ae29522. server/src/modules/{agents,repos,pulls,settings,polling,workspace,reviews}/composition.ts now creates repositories and services; their routes only resolve request context and invoke services. server/src/modules/repo-intel/source-analysis.ts owns Node filesystem and ast-grep imports; server/test/reviews.it.test.ts and agents-versions.it.test.ts passed after the change.
- Implication: Add new dependencies in a module composition factory, not in routes or application services. Keep only infrastructure adapters and composition code dependent on Container.

The server now has a consistent module-bootstrap boundary for the touched HTTP modules. This preserves Fastify handlers as inbound adapters while allowing application services to be constructed with narrow dependencies and tested without the DI container.

<!-- insight-id: eng-server-1b6cf249a445 -->
## eng-server-1b6cf249a445 — Ground repository evidence before and after extraction

- Date: 2026-10-05
- Category: security
- Evidence: server/src/modules/conventions/composition.ts rejects absolute and escaping sample paths before readFile; server/src/modules/conventions/application/verify-evidence.ts re-reads only sampled regular files and server/test/conventions-verifier.test.ts covers traversal, unsampled paths, and symlinks.
- Implication: Repository-grounded LLM flows must constrain filesystem reads before prompt assembly and derive persisted citations from disk after structured output.

A model path and snippet are untrusted output. Filtering only when persisting still permits an unsafe read or ungrounded prompt; the safe boundary is path validation before sampling plus verified file-line evidence before storage.

<!-- insight-id: eng-server-45f4416186f2 -->
## eng-server-45f4416186f2 — Contract review findings require a shared category

- Date: 2026-10-05
- Category: invariant
- Evidence: server/test/skills-experiments.it.test.ts produced no persisted API Contract finding until server/src/vendor/shared/contracts/findings.ts accepted category contract; client/src/vendor/shared/contracts/findings.ts was updated in lockstep.
- Implication: When adding a reviewer specialization, extend the shared FindingCategory contract in both vendored copies before relying on its structured output.

The structured Review schema validates category before grounding and persistence. A valid API-contract finding is rejected at that boundary when contract is absent, so the run can silently lack the intended review result.

<!-- insight-id: eng-server-d56bee8bcd32 -->
## eng-server-d56bee8bcd32 — Convention rows must cross the API as shared DTOs

- Date: 2026-10-05
- Category: boundary
- Evidence: server/src/modules/conventions/repository.ts returns Drizzle camelCase columns while client/src/vendor/shared/contracts/knowledge.ts requires snake_case ConventionCandidate fields; server/test/conventions-service.test.ts now verifies the conversion.
- Implication: Map convention persistence rows at the service boundary for list, scan, and status updates; do not pass Drizzle rows directly to Fastify handlers.

Drizzle column property names are persistence implementation details. The conventions UI consumes the shared snake_case contract, so leaking a raw row omits evidence_path and breaks source links even when the database contains a valid path.
