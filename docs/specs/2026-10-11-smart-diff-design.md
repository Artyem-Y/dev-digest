# Smart Diff — proposed design

Date: 2026-10-11. Status: proposed; planning only, implementation not approved.

## Goal and scope

Files changed shows reviewer-ordered groups and current agent findings next to code. Cover all homework P1 and P2 requirements. Include inexpensive P3 behavior: localization, no-review state, collapsing finding cards, and refresh after review without reloading. Sticky group headers are deferred until the actual scroll container has been verified.

Affected packages: client, server, e2e. Reviewer-core, prompts, persistence schema and migrations remain outside scope. The homework document is a requirements source; its submission instructions do not authorize creating a remote PR or recording/uploading a video during planning.

## Options considered

1. Client-only classification: smaller initial change, but duplicates server policy, misses the planned HTTP endpoint, and is less reusable for future prompt filtering.
2. Deterministic server classification with existing review data and client rendering: recommended. Fits the existing SmartDiff contract, has no model cost, and keeps roles authoritative on the server.
3. LLM classification or a persisted Smart Diff artifact: adds latency, cost and invalidation complexity without a requirement. Rejected.

## Agreed and proposed behavior

The user confirmed selecting the latest persisted `kind=review` result **per agent**, rather than the single latest PR review. Preserve the full Agent runs history. Treat a null agent as one distinct legacy bucket; a newer empty review replaces that agent's older findings. Resolve equal timestamps deterministically using descending review ID on both sides.

Return and render all five roles, including empty groups, in this order: core, tests, wiring, docs, boilerplate. Classification precedence differs deliberately: boilerplate, tests, wiring, docs, fallback core. Preserve incoming order within a group. Default to Smart order. Original order renders the supplied `pr.files` array directly, without groups or sorting; findings continue to work.

Group counters count distinct member files that have current findings. File headers show a finding dot separately from the existing human GitHub comment count. Include accepted and dismissed findings in existence counters; their existing card state remains visible and muted. Do not interpret Accept as applying a code fix or publishing a GitHub comment.

Docs and boilerplate groups start collapsed; the other groups start expanded. File expansion retains `AUTO_EXPAND_MAX_LINES=200`. Group and file expansion are independent. Group buttons expose `aria-expanded`; indicators have accessible text/tooltips. Use file paths rather than positional React keys.

Match findings only to `RIGHT:${start_line}` using the existing patch parser and line-key helpers. Display every finding at that anchor; use the strongest severity for the line stripe and label. Do not attach to a deleted LEFT line merely because its old line number matches. Findings outside the rendered patch, including null patches, appear in a separate file-footer block. Do not guess a new path for renamed or removed files.

Reuse FindingCard, expanded initially so severity, title and rationale are immediately visible. Move its implementation and private support files to shared review UI; preserve the current route import as a re-export. Actions use the existing finding mutation and pending/error behavior.

Use one Show/Hide comments control for both GitHub threads and findings. Start visible so required findings are discoverable; show the control when either source has content. Hiding cards does not erase group/file indicators. Use the existing severity tokens and icons, with localized line labels blocker, warning and suggestion. Localize all new Smart Diff copy.

## API and architecture

Extend SmartDiffRole in both vendored `contracts/brief.ts` files. Keep the existing SmartDiff payload, including `finding_lines`; deduplicate and numerically sort these line numbers. Do not use them as finding IDs or as the file-existence count: the complete findings come from the reviews query. Set split_suggestion to `{too_big:false,total_lines:sum(additions+deletions),proposed_splits:[]}` and omit pseudocode_summary. No model-generated summaries or split recommendations.

Add `GET /pulls/:id/smart-diff` with IdParams, workspace context, and `SmartDiffResponse` response schema. The application checks scoped PR existence before reading files/reviews and returns 404 for a missing or foreign PR. Wire a small application-owned read port in the existing reviews composition boundary; map existing repository rows there. Neither classification nor the use case imports Fastify, Drizzle, Container or a concrete external adapter.

The endpoint reads the stored snapshot only and never invokes GitHub, git, Intent derivation or an LLM. Fetch PR detail before enabling Smart Diff because the existing detail request refreshes the stored snapshot. Join grouped paths with `pr.files` for patches. Expose a retryable snapshot mismatch rather than silently omitting files. Original order remains usable if grouping fails.

Use one pure latest-review selection helper in both vendored shared copies so API finding_lines and client finding cards have the same policy. Client counts derive from the same full findings used for cards. Move the existing client latestFindingsPerAgent helper to a focused lib module and preserve its original export for PRRow compatibility.

Refresh reviews and Smart Diff at the PR-detail level when run history gains a terminal run, including when Files changed is active. Do not rely on FindingsTab being mounted or solely on the POST review response. Refresh after delete-run/delete-review; finding actions refresh reviews and Smart Diff together. No new SSE service or schema is necessary.

## Acceptance and delivery

Tests cover classification precedence, endpoint schema/workspace behavior, finding selection, group/file counters, right-side mapping, missing anchors, actions, original order, and cache refresh. Existing GitHub comments remain covered by regression cases. A hermetic browser fixture must supply all five roles and real synthetic patches: the current seed has only four patchless files despite its nine-file metadata.

Implementation follows planner → test-writer → implementer → (architecture-reviewer ∥ plan-verifier). This planning session used the planner role for an independent code-grounded check. The reviewers run after completed code exists; their reports must not be invented during planning. Submission later includes a fork PR, accurate role contributions, verifier results and a 1–3 minute demo showing the homework scenario.

Implementation plan: [2026-10-11-smart-diff.md](../plans/2026-10-11-smart-diff.md).
