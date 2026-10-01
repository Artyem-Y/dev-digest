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
