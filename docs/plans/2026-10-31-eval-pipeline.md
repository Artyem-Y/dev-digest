> Update 2026-10-31: The prepared-input-only policy below was superseded by the user. New reviews retain an input fingerprint; creating a case stores a verified original diff fragment. See the current specification and package documentation for the implemented contract.

# Eval Pipeline Implementation Plan

> **Execution:** User authorized implementation on 2026-10-31. Use the repository's `run-plan` workflow and plan-verifier. Follow package instructions and `engineering-insights` workflow.

**Goal:** Turn reviewed findings into a reproducible agent evaluation set, execute it, and compare honest, deterministic metrics across agent configurations.

**Architecture:** The server stores prepared fixture identifiers, hashes and immutable expectations, takes a versioned snapshot of the complete dataset and resolved agent configuration per batch, and invokes the existing reviewer through injected adapters. A pure scorer uses grounded findings and explicit labels; the client presents cases, runs, and comparisons using typed APIs. Deterministic browser tests and a separately reported real-provider experiment establish different kinds of evidence.

**Tech stack:** Fastify, TypeScript, Drizzle/PostgreSQL, Zod, reviewer-core, Next.js, TanStack Query, Vitest, agent-browser.

## Execution ownership and traceability

Single-agent implementation in task order, with the implementation owner responsible for each task, focused checks and package integration gates. An independent plan verifier owns preflight and completion review. T0 precedes T1; T2 and T3 follow T1; T4 and T5 follow T3; T6 follows all implementation tasks. The user requested execution of this plan on 2026-10-31; the specification captures the proposed semantics as a draft for implementation review.

| Specification requirements | Tasks | Focused verification | Integration evidence |
|---|---|---|---|
| AC-1, AC-2, AC-9 | T1, T3, T4 | Scoped creation and provenance route and persistence tests | Server integration, client, hermetic journey |
| AC-3, AC-6 | T1, T2, T3 | Snapshot, failure, recovery and bounded runner tests | Server integration, clean and upgrade migrations |
| AC-4, AC-5 | T2 | Pure scorer cases, zero denominators and grounding counts | Server suite and deterministic browser journey |
| AC-7, AC-8 | T3, T4, T5 | API and component state/comparison tests | Client build and hermetic browser journey |
| AC-10 | T6 | Eight actual decisions and observed live prompt comparisons | Real-provider evidence and screenshot, separate from fixtures |
| AC-11 | T0, T6 | Locate and execute the course verifier if available | Exact command and exit, or explicitly report absence |

## Scope and existing evidence

- Requested scope is the Eval Pipeline. The title mentions agent export, but gives no export requirements or acceptance journey; treat export as a separate follow-up, not an invented deliverable. `pnpm verify:l06` may have additional lesson-wide prerequisites; inspect its actual definition before promising that it verifies this feature.
- The six attached screenshots specify the finding action, agent Evals tab, case editor, dashboard overview, agent detail/trend, and comparison modal. The linked Drive design was not inspected; the supplied images are the design evidence for this plan.
- `server/src/db/schema/eval.ts` already defines `eval_cases` and per-case `eval_runs`; `server/src/vendor/shared/contracts/eval-ci.ts` supplies preliminary, loosely typed contracts. They lack a persisted suite-run identity and immutable agent/dataset snapshots. Extend via a new migration; do not recreate or alter historical migrations. Keep both shared contract copies identical.
- `server/src/modules/reviews/findings.ts` persists mutually exclusive acceptance decisions. `reviews/diff-loader.ts` can load current Git state or reconstruct current PR patches, so it does not establish that the selected diff is the one reviewed historically. `reviewer-core/src/review/run.ts` returns grounded findings plus dropped findings and nullable cost; scorer must consume structured counts, not parse its human-readable summary.
- `AgentEditor.tsx` currently renders Config, Skills and Context; `FindingCard` already renders decisions. Reuse the existing shell, APIs and UI primitives. The repository has no root `package.json` according to the current file listing; do not assume the requested `pnpm verify:l06` exists.

## Product and scoring decisions to ratify in the specification

1. Create only from an accepted/dismissed finding owned by the current workspace and linked to an agent. A pending decision, missing agent, unavailable or mismatched prepared fixture produces a clear actionable error; never silently label a current diff historical. After explicit preview and confirmation, save the decision, source identity, anchor, fixture ID and content hash at creation; subsequent finding edits do not silently change the case. Idempotently prevent accidental duplicate creation for the same finding and decision; explicitly define what happens after a decision changes.
2. One case is one independently replayed input with one labeled anchor. Require the prepared fixture to match the finding file and inclusive line range. Exact normalized repository-relative path plus inclusive line overlap determines a match. Grounded matches to `must_find` are true positives, unmatched positive cases are false negatives; grounded matches to `must_not_flag` are known false positives. A finding outside the labeled anchor is **unlabeled**, not automatically a false positive or true positive. Expose counts and label the resulting `TP / (TP + known FP)` as precision on labeled findings, with unlabeled count; it is not global precision. Deduplicate overlapping predictions for the case before counting so duplicates cannot inflate TP; document the deterministic matching rule. Overlapping contradictory labels in an identical input are rejected or require explicit resolution.
3. Recall = matched positive cases / positive cases. Citation accuracy = total grounding-kept / (kept + dropped), aggregated from structured outcome, including the engine's documented full-file exceptions. A zero denominator yields `null` / “—”, not 100% or 0%; a case passes when its specific positive or negative expectation holds. Failed, cancelled or incomplete cases do not enter aggregate metrics; incomplete batches are visibly incomplete and cannot masquerade as comparable successful runs.
4. Freeze ordered case snapshots, fixture IDs and content hashes, full resolved agent prompt, provider/model, skill bodies, strategy and every other included prompt input at admission. Disable or snapshot dynamic context, repo map, intent and memory consistently and disclose omissions. Snapshot engine/scorer version. A dataset fingerprint covers inputs, labels and scoring semantics, not agent configuration. Comparison displays whether dataset and engine/scorer match; differing fingerprints disable numerical deltas or label them non-comparable. Agent prompt/model/skills differences remain visible. Sampling/provider variability means fixed inputs do not guarantee identical output.
5. Screenshots show new/edit/delete/run-one, run-all-agents and promote controls beyond the minimum textual journey. Specify and implement each as functional with scoped validation, or explicitly mark deferred and remove/disable with explanation; never ship inert buttons. Any future manual editor must validate against a reviewed prepared input, while the acceptance dataset contains at least eight cases derived from real decisions.

## Tasks and acceptance gates

### T0 — Specification and acceptance contract

- [ ] Create `docs/specs/2026-10-31-eval-pipeline.md` and update `docs/specs/README.md`; the lesson's `specs/eval-pipeline.md` path conflicts with this repository's cross-module SDD convention. Document the mapping and verify whether the external verifier requires the literal path; if it does, add a small compatibility link or document at that path without duplicating the canonical spec.
- [ ] Write EARS acceptance criteria for both decision types, explicit prepared-fixture selection and confirmation, dataset/version snapshots, scorer examples and null denominators, error/recovery states, accessibility, comparison compatibility, ≥8 real cases, and the real-provider sensitivity experiment. Map every visible screenshot control and screen to implemented behavior or an explicit deferral. Include privacy, workspace scope, cost and execution bounds. Obtain review of unresolved product decisions before implementation.
- [ ] Locate the actual `verify:l06` command and its ownership using `rg -n 'verify:l06' --glob 'package.json'`; if absent, document the missing course verifier and define a transparent feature-specific verification command rather than claiming an unrelated command passed. Distinguish any unrelated lesson-wide gates.

### T1 — Contracts, provenance, and persistence

- [ ] Design shared Zod DTOs in both `client/src/vendor/shared/contracts/` and `server/src/vendor/shared/contracts/`: validated expectation, immutable case input, case result, suite run status/snapshot, nullable metrics/counts, comparison compatibility, list/create/run payloads. Preserve existing consumers and verify both copies byte-identical.
- [ ] Extend `server/src/db/schema/eval.ts` with source provenance and immutable suite-run / case-result storage. Capture one snapshot per batch transactionally before enqueueing; retain historical results after a case is edited or deleted. Make duplicate creation safe under concurrency, scope all lookups to workspace, and define deletion/retention of source references. Store no credentials or raw provider responses. Handle legacy rows without fabricated batch identity.
- [ ] Register reviewed, safe prepared inputs with stable IDs. Require explicit user confirmation and matching file and line range. Persist only the fixture ID and hash, and reject replay when the registered content has changed or is unavailable. Never capture the original PR diff.
- [ ] Generate a forward-only migration using `server` migration procedure; verify both a populated previous-schema upgrade and clean full-chain creation on isolated PostgreSQL. Check migration metadata and preserve all existing history. Tests cover backfill/legacy reads, scoping, duplicate races, deletion/history, and missing or changed fixture.

### T2 — Pure scorer and review execution

- [ ] Add `server/src/modules/evals/domain/score.ts` with no provider, database or network dependency. Test exact-path and inclusive boundary overlap, no-overlap, duplicate findings, negative match, unlabeled findings, contradictory anchors, both zero denominators, dropped citations and full-file grounding behavior. Test a known fixture such as two positives (one found), one negative (one flagged), and one unlabeled: recall 1/2, labeled precision 1/2, unlabeled 1. Test that scoring invokes no LLM.
- [ ] Build application ports and a runner in `server/src/modules/evals/`, wiring real review through `reviewer-core` and the server DI container. Capture numeric kept/dropped counts from `ReviewOutcome`, nullable cost, duration, case-level output and stable errors. Mock providers in automated tests. Ensure execution uses frozen inputs and linked skills, and that subsequent edits/deletions cannot mutate admitted snapshots.
- [ ] Bound case count, input size, concurrency, retry count and provider timeouts; choose explicit limits in the spec. Persist queued/running/completed/failed state, per-case failures and recovery of interrupted runs using existing single-process assumptions; reject duplicate admission or make it idempotent. No partial run may appear successful. Sum cost only if all constituent costs are known; otherwise null.

### T3 — Scoped API

- [ ] Add `server/src/modules/evals/routes.ts`, application services and repository, register in `server/src/modules/index.ts` and compose dependencies in `server/src/platform/container.ts`. Use `modules/_shared/context.ts` and existing onion-architecture conventions; read `.claude/skills/onion-architecture/SKILL.md` before implementation.
- [ ] Provide scoped creation from `POST /findings/:id/eval-cases`, listing via `GET /agents/:id/eval-cases`, batch creation via `POST /agents/:id/eval-runs`, batch/status/history reads and workspace dashboard reads. Define exact response/status codes in the spec, including no cases, unreviewed finding, missing source, duplicate, cross-workspace ID and running/failed states. Add case mutation and single-case endpoints only if their screenshot controls are included in T0.
- [ ] Route tests with `app.inject()` and mock adapters prove contract serialization, authorization and rate limiting. PostgreSQL integration tests prove snapshots, history, batch progress/failure and comparisons after a case or agent changes.

### T4 — Finding and agent UI

- [ ] In `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/`, add localized “Turn into eval case” with eligibility, pending, success/already-created and actionable failure states. Button uses persisted decision and server-derived agent; avoid a client-computed expectation.
- [ ] Add typed requests in `client/src/lib/api.ts` and hooks under `client/src/lib/hooks/`; invalidate case/run/dashboard queries after mutations and poll while a run is active. Handle fetch failure, empty dataset, incomplete run, unknown metrics/cost, and reload.
- [ ] Add Evals tab to `AgentEditor` with metric cards, per-case pass/fail/unrun, run all, history and link to dashboard. Implement the screenshot's case editor and controls per T0; support keyboard and focus management. Component tests cover both decisions, errors, no data, run lifecycle, and non-inflated values.

### T5 — Dashboard and comparison

- [ ] Add sidebar navigation and `client/src/app/eval/` dashboard, with all agents, latest metrics, recent runs and navigation to an agent detail page. Detail provides metric cards, trend, run history, agent/date filters, selection of exactly two runs and run action. Derive data from persisted batch records rather than fabricated labels or charts.
- [ ] Comparison modal shows old/new metrics, counts, nulls, cost and prompt diff using immutable snapshots, with compatibility warning/disabled deltas where appropriate. Preserve keyboard focus and accessible labels; implement promotion only if an actual scoped agent-version action exists and is specified. Test two agents, incompatible snapshots, different prompt/skills/models, failed runs, multiple selected rows, loading/empty/error, keyboard and narrow layouts.

### T6 — Evidence, documentation and handoff

- [ ] Add a hermetic-only E2E flow in `e2e/specs/` and an isolated fixture: decide accepted and dismissed findings, create cases, run with a deterministic provider, observe metrics, change prompt, run again, compare and reload. Assert counts and snapshots, not merely visible headings. Follow `scripts/e2e.sh` attestation; never mutate the development database. Run populated, long-path, loading, error, empty and responsive visual checks against all supplied screenshots, including editor and comparison; record any deliberate deviation.
- [ ] Run focused server scorer/routes/integration tests, client component tests, reviewer-core tests if changed, all affected package typechecks, client build, and hermetic browser flow. Run full affected suites proportionate to persistence and cross-package risk. Run upgrade and clean migration checks. Record actual command and exit; a skipped Docker test is not a pass.
- [ ] Real-provider acceptance is separate: obtain at least eight genuine accepted/dismissed decisions across relevant inputs, freeze dataset and model/settings, run baseline and changed prompt, then deliberately degraded prompt. Record actual per-case outcomes, metric numerators/denominators, dataset fingerprints, cost when known and screenshot of the comparison. Do not guarantee a prompt change will move metrics or assert precision fell without observing it; if not observed, report the criterion unmet and investigate. The live experiment incurs provider calls; scoring itself makes none.
- [ ] Update durable topic docs and their `docs/README.md` indexes for every package whose behavior changes; identify behavior-preserving packages explicitly. Check insights logs for novel non-duplicate findings and append only via the helper. Inspect final diff, run `git diff --check`, then run the actual `pnpm verify:l06` if available and report its exact scope and exit. Do not claim the screenshot or live experiment based on fixture E2E.

## Completion criteria

All implemented controls and states match the approved specification; both case types and ≥8 real cases are demonstrated; scoring is deterministic and model-free; historical dataset and configuration snapshots make comparisons auditable; workspace boundaries and migrations are verified; a real prompt sensitivity experiment and screenshot are observed; the actual lesson verifier passes or its absence/failure is explicitly reported. Preserve unrelated worktree changes throughout.
