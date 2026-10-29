# Onboarding Generator Implementation Plan

> **For agentic workers:** Use the repository's `run-plan` workflow and `superpowers:executing-plans` for this single-agent plan. Do not begin implementation until the plan has been approved and the plan-verifier preflight has passed.

**Goal:** Provide an authorized, persistent repository tour with five evidence-backed sections, a single optional narrative request, honest partial results, and observable usage.

**Architecture:** The server captures a bounded, revision-attributed fact snapshot through repository-intelligence and safe source adapters, generates a deterministic skeleton, and optionally asks reviewer-core for one structured narrative. Server-side validation resolves model references against the snapshot before storage; the client renders the persisted result and independent attempt state. A database-backed attempt record provides admission and recovery, while GET remains read-only.

**Tech stack:** Fastify, TypeScript, Zod, Drizzle/PostgreSQL, injected LLM providers, Next.js, TanStack Query, Vitest, agent-browser.

## Overview

Input: [SPEC-2026-10-29-onboarding-generator](../specs/2026-10-29-onboarding-generator.md). The user explicitly approved the draft as the planning basis on 2026-10-29; the specification file itself remains unchanged. Existing `/onboarding` is the add-repository flow and remains distinct from `/repos/:repoId/tour`.

## Execution mode

Single-agent, one pass, in the dependency order below. The implementer owns each focused check and is also the integration owner for server, reviewer-core, client and E2E. Capture command, exit status, scope and worktree revision/hash for each receipt. Plan-verifier independently reviews preflight and completion evidence; it does not implement changes.

## Requirements (verified)

AC-1 through AC-22 and all non-functional requirements in the specification apply without renumbering. Key invariants: explicit user initiation; five ordered sections; deterministic bounded evidence and honest omissions; no more than one structured provider request per attempt; retained previous result on failed regeneration; scoped sharing; nullable usage; no execution, unsafe links, raw HTML, or sensitive logs. Source identity is the captured indexed revision where available, never an inferred current revision. The required demo includes actual request count and available cost; deterministic fixture evidence and an observed real-model demonstration are separate.

## Traceability & verification matrix

All focused checks are owned by the single implementer; all integration gates are owned by the same package integration owner. Commands are run from the named package. Expected evidence is a zero exit and assertions described in the linked task, unless explicitly marked manual.

| Requirement | Tasks | Focused check / expected evidence | Integration gate |
|---|---|---|---|
| AC-1 | T1, T6, T7 | `client: pnpm exec vitest run src/lib/hooks/onboarding-tour.test.ts src/app/repos/[repoId]/tour/_components/OnboardingTour.test.tsx` — repository, empty and saved states | client gate G3; browser G4 |
| AC-2 | T2, T5, T7 | `server: pnpm exec vitest run test/onboarding-service.test.ts` — pending and duplicate admission | server G2; browser G4 |
| AC-3, AC-4 | T3 | `server: pnpm exec vitest run test/onboarding-facts.test.ts` — repeatable selection, both limits and counts | server G2 |
| AC-5 | T1, T4, T7 | client focused check above — five ordered independent disclosures in all states | client G3; browser G4 |
| AC-6 | T4, T5 | `reviewer-core: npm exec vitest run test/onboarding.test.ts` and server service test — exactly one request, zero retries | core G1; server G2; real-model G5 |
| AC-7, AC-12 | T3 | `server: pnpm exec vitest run test/onboarding-facts.test.ts test/repo-intel-onboarding.test.ts` — rank, ties, no graph and unknown hotness | server G2 |
| AC-8, AC-9 | T3, T4, T5 | `server: pnpm exec vitest run test/onboarding-grounding.test.ts test/onboarding-facts.test.ts` — unsupported references and claims cannot survive | server G2; real-model G5 |
| AC-10, AC-11, AC-13, AC-14 | T3, T5, T7 | server service and client component tests — partial skeleton, reason and retry | server G2; client G3; browser G4 |
| AC-15, AC-16 | T2, T5, T7 | `server: pnpm exec vitest run test/onboarding.it.test.ts` — persistence, revision comparison, unknown freshness and reload | server G2; browser G4 |
| AC-17 | T2, T5, T7 | service and integration tests — previous result survives pending and failed attempts, including reload | server G2; browser G4 |
| AC-18 | T2, T6, T7 | `server: pnpm exec vitest run test/onboarding.it.test.ts test/onboarding-routes.test.ts` — cross-workspace denial and safe file access | server G2; browser G4 |
| AC-19, AC-20 | T1, T4, T5, T7 | service and component tests — zero/one call, nullable usage and redacted logs | core G1; server G2; client G3; G5 |
| AC-21, AC-22 | T7, T8 | client component test — keyboard, disclosure semantics and exact clipboard value; browser G4 | client G3; browser G4 |
| Migration, security, bounded work, cancellation and recovery | T2, T3, T4, T5, T6, T8 | migration upgrade and clean-chain integration tests; adversarial grounding and path tests; interrupted attempt test | server G2; G4; security review T9 |

## Open questions & recommendations

No blocking product questions remain. The user chose single-agent execution and accepted the specification as the planning basis. Recommendations for implementation: make the five section identities and all referenced facts structured rather than accepting arbitrary Markdown references; show a textual architecture when a safe deterministic diagram cannot be derived; retain only the latest accepted tour and latest attempt, avoiding an unnecessary history feature. These are implementation choices, not changes to acceptance criteria. The checked-in spec still says draft; record the user's approval in review context rather than editing the specification in this planning task.

## Affected modules & contracts

- `server`: repository-scoped API, fact selection, admission, persistence, authorization, logs, and fresh migration. Existing `src/db/schema/context.ts` has an `onboarding` row with only `repo_id`, `json` and `generated_at`; preserve existing rows during upgrade. `src/modules/repo-intel/service.ts` currently fetches up to 100,000 rank rows for critical paths and rank pipeline stores unavailable hotness as zero. Neither behavior satisfies this feature's bounded/availability contract without adaptation.
- `reviewer-core`: injected structured model adapter and canonical prompt serialization; no filesystem, DB or server imports. `server/src/prompts/onboarding.system.md` describes incompatible old sections; replace its role with the new canonical prompt or explicitly retire it so no stale prompt is used.
- `client`: repository route, navigation, typed API hook, localized copy and accessible presentation. The two `src/vendor/shared` copies must remain identical.
- `e2e`: hermetic-only seeded flow and stub provider; no paid call in automated tests. Root `scripts/e2e.sh` and server fixture adapter are part of the integration boundary.

## Architecture changes

1. Shared DTO distinguishes `tour` (nullable persisted accepted result) from `attempt` (pending or terminal outcome and safe reason). Tour has five fixed section IDs, sourced items, captured revision, index state/counts, limitations, generated time and nullable usage. `attempt.call_count` is an integer 0 or 1; `input_tokens`, `output_tokens`, and `cost_usd` are nullable. Freshness is `current`, `stale`, or `unknown`, computed from captured and current indexed revisions; never claim current on unknown.
2. Capture source/index revision and bounded facts as one generation snapshot. For any source read, verify workspace ownership before access and use a revision-pinned tracked Git tree/blob adapter or the established safe file policy. Explicitly expose unavailable source, graph and hotness independently. Read at most 5,000 indexed file records in deterministic ordering, with indexed and omitted counts when known. Bound the exact canonical facts serialization to 12,000 estimated tokens, including labels and delimiters; expose estimated budget separately from provider usage.
3. Give each factual entry an immutable ID and typed payload (path, command, route, dependency, stack or source-backed observation). Model output contains claim text plus supporting fact IDs, not arbitrary hyperlinks or shell blocks. Validate IDs, section placement, referenced exact paths/routes/dependencies/commands and text-bearing claims against the corresponding typed evidence; drop unsupported output and use deterministic section fallback. Because fact IDs alone cannot prove arbitrary prose entailment, render unverified free-form prose only when it is constrained to templates derived from typed facts; exploratory task suggestions must name their supporting facts and be labelled suggestions. No generated URL, HTML, diagram or command becomes an action without validation.
4. POST starts a persisted attempt and returns its ID/state; polling GET reads persisted state. An atomic unique active attempt per repo prevents duplicate work even across server processes; use an expiring ownership lease with a fencing token on writes and a finite provider timeout, so a restart/expiry transitions abandoned work to a safe terminal failure and stale workers cannot overwrite newer results. Define cancellation on shutdown/expiry as terminal and preserve previous accepted tour. Atomically persist accepted result and attempt terminal status; failed regeneration only updates attempt state. Storage failures return safe errors and never claim persistence.
5. The link is the normal repository-scoped page URL, requiring the same authenticated workspace/repository access on every server request. File actions use a validated relative path and revision through a scoped server endpoint; no arbitrary redirect, external URL or symlink escape. Commands are displayed text and copied verbatim only.

## Phased tasks

### Phase 1 — Contracts and persistence

- **T1**
  - **Action:** Add `contracts/onboarding-tour.ts` and exports in both `server/src/vendor/shared/` and `client/src/vendor/shared/`. Define the fixed section tuple, fact references, nullable usage, counts, status, safe failure codes, result and attempt DTOs described above. Preserve the legacy `knowledge.ts` contract for existing consumers. Add schema tests covering exact section order, unknown versus zero, malformed refs and separate result/attempt state. Verify the copies byte-for-byte.
  - **Module:** server and client shared contracts.
  - **Skills to use:** `api-contract-reviewer`, `zod`, `typescript-expert`.
  - **Owned paths:** `server/src/vendor/shared/contracts/onboarding-tour.ts`, `client/src/vendor/shared/contracts/onboarding-tour.ts`, both `src/vendor/shared/index.ts`, `server/test/onboarding-contract.test.ts`.
  - **Verification owner:** leaf implementer. **Focused check:** `cd server && pnpm exec vitest run test/onboarding-contract.test.ts` and `cmp server/src/vendor/shared/contracts/onboarding-tour.ts client/src/vendor/shared/contracts/onboarding-tour.ts` from root.
  - **Integration gate:** G2 and G3. **Depends-on:** none. **Risk:** medium. **Known gotchas:** shared vendored copies must match.
  - **Acceptance:** DTO validation rejects reordered/missing sections and preserves null usage separately from zero.

- **T2**
  - **Action:** Extend `server/src/db/schema/context.ts` and generate a new Drizzle migration plus metadata for tour provenance and attempt records, retaining existing onboarding JSON rows. User approved a separate migration journal and migrator extension to keep the existing `migrations/meta` files immutable: place the new journal, migration SQL and generated metadata in a separate migration directory; extend `runMigrations` to apply the original chain first and the new chain second, with a distinct migrations table for the new chain. Preserve idempotency and verify ordering, a clean full chain, and upgrade from the old chain, including repeated application. Scope reads/writes by joining `repos.workspaceId`; add an atomic unique active-attempt constraint, lease expiry, fencing token and transactional result/attempt finalization. Preserve the previous tour on failure. Cover simultaneous admissions, crash/expiry, stale worker writes, cancellation and cross-workspace access against Postgres.
  - **Module:** server. **Skills to use:** `onion-architecture`, `drizzle-orm-patterns`, `postgresql-table-design`.
  - **Owned paths:** `server/src/db/schema/context.ts`, `server/src/db/migrate.ts`, new `server/src/db/onboarding-migrations/` SQL and metadata, `server/src/modules/onboarding/infrastructure/onboarding.repository.ts`, `server/test/onboarding.it.test.ts` and migration test fixtures.
  - **Verification owner:** leaf implementer. **Focused check:** use a temporary copy of the existing Drizzle migration directory and a temporary generation config pointing there; run `cd server && pnpm exec drizzle-kit generate --config <temporary-config>` against the copied baseline and current schema, inspect the generated SQL as only the intended delta, then copy only the new SQL and newly generated snapshot into `onboarding-migrations/` and create its separate journal containing that delta with the generated timestamp. Never run `pnpm db:generate` against the original directory. Run `cd server && pnpm exec vitest run test/onboarding.it.test.ts` with Docker; integration tests must explicitly exercise both old-schema upgrade and empty-db chain.
  - **Integration gate:** G2. **Depends-on:** T1. **Risk:** high. **Known gotchas:** committed migrations and existing metadata are immutable; do not treat a unit mock as migration evidence.
  - **Acceptance:** one active attempt per repository, stale owner cannot commit, previous row survives upgrade/failure, and both migration paths pass.

### Phase 2 — Evidence and model boundary

- **T3**
  - **Action:** Add a bounded repo-intel snapshot method with explicit index revision, graph usability, hotness availability, counts, ranked paths and dependency edges; order rank descending then path ascending at the database boundary before applying limits. Distinguish a graph with no usable edges from a valid rank; never infer measured hotness from stored zero. Avoid existing `getCriticalPaths` unbounded 100,000-row read. Build typed deterministic fact selection and skeleton from authorized revision-pinned source facts, including supported scripts/routes/dependencies and source-backed TODOs when available. Handle missing checkout/index and source changes; deterministic fallback path is lexically ordered and labelled unranked. Estimate canonical selected facts including framing, drop lowest-priority facts until at most 12,000 estimated tokens, and disclose omitted/truncated counts when known.
  - **Module:** server. **Skills to use:** `onion-architecture`, `typescript-expert`, `security`.
  - **Owned paths:** `server/src/modules/repo-intel/types.ts`, `service.ts`, `repository.ts`; `server/src/modules/onboarding/domain/facts.ts`, `skeleton.ts`, `server/src/modules/onboarding/application/collect-facts.ts`, `ports.ts`, `server/src/modules/onboarding/infrastructure/source-reader.ts`; `server/test/onboarding-facts.test.ts`, `server/test/repo-intel-onboarding.test.ts`.
  - **Verification owner:** leaf implementer. **Focused check:** `cd server && pnpm exec vitest run test/onboarding-facts.test.ts test/repo-intel-onboarding.test.ts`.
  - **Integration gate:** G2. **Depends-on:** T1. **Risk:** high. **Known gotchas:** shallow-clone hotness is unavailable despite stored zeros; existing critical-path query is not bounded to 5,000.
  - **Acceptance:** shuffled identical input gives identical selection and ranks, ties break by path, no-graph fallback has no fabricated rank, and 5,001 files / oversized facts disclose truncation.

- **T4**
  - **Action:** Add `reviewer-core/src/onboarding.ts` exporting typed structured output schema, canonical prompt assembly and facts-token estimator, and `generateOnboarding` using the injected provider exactly once with `maxRetries: 0`. Wrap facts as untrusted; expose provider-reported usage and nullable cost without fabricating values, adapting provider interfaces if needed. Use an ordered five-section schema with typed fact IDs and constrained claim forms. Replace or retire `server/src/prompts/onboarding.system.md` so the legacy sections cannot be called accidentally. Test prompt injection, full canonical budget accounting, malformed structured output, request count, absent usage and no retry using a stub provider.
  - **Module:** reviewer-core and server prompt. **Skills to use:** `typescript-expert`, `zod`.
  - **Owned paths:** `reviewer-core/src/onboarding.ts`, `reviewer-core/src/index.ts`, `reviewer-core/test/onboarding.test.ts`, `server/src/prompts/onboarding.system.md`, provider contract/adapter files only if usage propagation requires them.
  - **Verification owner:** leaf implementer. **Focused check:** `cd reviewer-core && npm exec vitest run test/onboarding.test.ts`.
  - **Integration gate:** G1 and G2. **Depends-on:** T1, T3. **Risk:** high. **Known gotchas:** count system framing in the canonical budget and do not log prompts or source.
  - **Acceptance:** provider stub observes exactly one structured call with retries disabled; missing usage remains null and malformed output causes failure.

### Phase 3 — Orchestration and transport

- **T5**
  - **Action:** Implement application services to authorize, admit, collect and snapshot facts, build skeleton, conditionally resolve the configured provider, execute one call, validate output, and finalize atomically. Required index/facts or provider missing means zero calls and a partial skeleton if no prior tour exists. Invalid output, timeout or provider failure retains an existing tour; without one, persist a partial skeleton with safe reason. Add `filter-output.ts` enforcing Architecture step 3, including adversarial embedded paths, shell commands, routes, links, HTML, invented issue/TODO and unsupported assertions. Include attempt outcome, 0/1 calls and nullable provider usage/cost in structured logs only; never emit prompt, repository text, raw exception or secrets. Test persistence failure, cancellation, source revision change, provider errors and exact call counts.
  - **Module:** server. **Skills to use:** `onion-architecture`, `security`, `typescript-expert`.
  - **Owned paths:** `server/src/modules/onboarding/application/generate-tour.ts`, `get-tour.ts`, `ports.ts`; `server/src/modules/onboarding/domain/filter-output.ts`; `server/src/modules/onboarding/composition.ts`; `server/test/onboarding-service.test.ts`, `server/test/onboarding-grounding.test.ts`.
  - **Verification owner:** leaf implementer. **Focused check:** `cd server && pnpm exec vitest run test/onboarding-service.test.ts test/onboarding-grounding.test.ts`.
  - **Integration gate:** G2. **Depends-on:** T2, T3, T4. **Risk:** high. **Known gotchas:** preserving the old tour and recording the failed latest attempt are separate operations; usage unavailable is not zero.
  - **Acceptance:** unsupported claims/actions cannot reach persisted display, and failure or stale worker never replaces a previous result.

- **T6**
  - **Action:** Register `server/src/modules/onboarding/routes.ts` in `server/src/modules/index.ts`. Expose authenticated `GET /repos/:id/onboarding-tour`, rate-limited `POST /repos/:id/onboarding-tour`, and scoped `GET /repos/:id/onboarding-tour/file` using a schema-validated query for a captured relative path/revision. GET never invokes a provider. POST returns attempt status/ID and duplicate requests observe the existing active attempt. Resolve context with `getContext`, enforce repo ownership in each operation, and return safe unavailable results for missing/deleted/unsafe files. Use existing adapter mechanisms; do not return arbitrary URLs or follow symlinks.
  - **Module:** server. **Skills to use:** `fastify-best-practices`, `api-contract-reviewer`, `security`.
  - **Owned paths:** `server/src/modules/onboarding/routes.ts`, `server/src/modules/index.ts`, `server/test/onboarding-routes.test.ts`.
  - **Verification owner:** leaf implementer. **Focused check:** `cd server && pnpm exec vitest run test/onboarding-routes.test.ts test/onboarding.it.test.ts`.
  - **Integration gate:** G2. **Depends-on:** T5. **Risk:** high. **Known gotchas:** repository ID alone is not authorization; scoped lookups must precede any file read.
  - **Acceptance:** cross-workspace GET/POST/file requests reveal no content, navigation/reload GET causes zero provider calls, and unsafe/deleted paths fail closed.

### Phase 4 — Client and end-to-end journey

- **T7**
  - **Action:** Add the repository tour page and navigation via `client/src/vendor/ui/nav.ts` and existing shell active-route handling. Place **Onboarding Tour** in **WORKSPACE** between **Pull Requests** and **Project Context**, as in the user-provided 2026-10-29 screenshot (`/Users/artem/Downloads/880170b0-edf6-493b-a5bf-5d1f60e8d111image (7).png`); match its page navigation, five section cards and top actions while supporting all specified states. Add typed query/mutation hooks in `client/src/lib/hooks/onboarding-tour.ts`, using `src/lib/api.ts`; poll only while pending and invalidate on terminal state. Build `OnboardingTour.tsx` with five accessible disclosures in fixed order, pending/empty/partial/previous-result/failure states, revision/freshness/limitations, count and nullable cost, labelled suggestions, safe file links, copy-exact-command success/failure feedback and share URL copy. Use text alternatives for diagram; render no raw HTML or arbitrary model links. Add copy in `client/messages/en/onboarding-tour.json` and register it in the existing i18n loader. Compare rendered layout and interaction to the supplied screenshot; if unavailable, explicitly report that visual comparison as unverified.
  - **Module:** client. **Skills to use:** `frontend-ui-architecture`, `react-best-practices`, `react-testing-library`, `next-best-practices`.
  - **Owned paths:** `client/src/app/repos/[repoId]/tour/page.tsx`, `client/src/app/repos/[repoId]/tour/_components/OnboardingTour.tsx`, `OnboardingTour.test.tsx`, `client/src/lib/hooks/onboarding-tour.ts`, `onboarding-tour.test.ts`, `client/src/vendor/ui/nav.ts`, relevant shell active-route file, `client/messages/en/onboarding-tour.json`, existing message loader.
  - **Verification owner:** leaf implementer. **Focused check:** `cd client && pnpm exec vitest run 'src/app/repos/[repoId]/tour/_components/OnboardingTour.test.tsx' src/lib/hooks/onboarding-tour.test.ts`.
  - **Integration gate:** G3 and G4. **Depends-on:** T1, T6. **Risk:** medium. **Known gotchas:** previous result remains visible during and after failed regeneration; unknown cost and freshness must not appear as zero/current.
  - **Acceptance:** keyboard and screen-reader semantics, five distinct sections, exact clipboard text, failed clipboard message, safe file/share actions and all lifecycle states are asserted.

- **T8**
  - **Action:** Add a hermetic-only deterministic onboarding fixture and `e2e/specs/14-onboarding-tour.flow.json`, extending the existing hermetic attestation in `e2e/run.ts` and `scripts/e2e.sh` rather than enabling mutations against the developer DB. Seed a small repository snapshot and stub structured provider with deterministic call count and cost; exercise entry, explicit generation, pending, five sections, source/usage, disclosure, copy, share, reload without new call, then failed regeneration retaining the prior tour and retry. Assert authorization and missing file via server integration tests; add browser assertions where fixture support permits. Document new standard flow and setup in affected READMEs.
  - **Module:** e2e, server fixture, client and root runner. **Skills to use:** `devdigest-verification`, `react-testing-library`.
  - **Owned paths:** `e2e/specs/14-onboarding-tour.flow.json`, `e2e/run.ts`, `e2e/README.md`, `e2e/specs/README.md`, `scripts/e2e.sh`, `server/src/adapters/llm/e2e-onboarding-fixture.ts`, relevant hermetic fixture wiring and tests, affected package READMEs.
  - **Verification owner:** integration owner. **Focused check:** `cd e2e && npm run typecheck` and from root `E2E_FLOW=14-onboarding-tour.flow.json ./scripts/e2e.sh`.
  - **Integration gate:** G4. **Depends-on:** T7. **Risk:** high. **Known gotchas:** hermetic Next output uses `.next-e2e`; preserve `client/next-env.d.ts` after the runner and do not run typecheck while Next generates types.
  - **Acceptance:** exit-zero isolated browser flow proves the stated journey with no external model; missing Docker/browser is recorded as unverified, not passed.

### Phase 5 — Verification and handoff

- **T9**
  - **Action:** Run gates below, inspect final diff and `git diff --check`, reconcile every AC and screenshots with code, test receipts and UI states. Invoke local `plan-verifier` completion, then dispatch `architecture-reviewer` and `security-reviewer` independently under the handoff protocol for the cross-package changes and new trust boundaries; the integration owner supplies the review packet and owns remediation and receipts. Run the requested real-model demo only with an explicitly user-triggered generation and available configured provider; capture call count and cost or unavailable, without logging source/prompt/secrets. Record real-model evidence separately from fixture E2E. Re-read affected insights and append only novel, evidence-backed, non-duplicate entries through the helper.
  - **Module:** all affected packages. **Skills to use:** `devdigest-verification`, `devdigest-security-review`, `engineering-insights`, `pr-self-review`.
  - **Owned paths:** verification artifacts and any necessary corrections in preceding owned paths; insight logs only through helper.
  - **Verification owner:** integration owner. **Focused check:** `git diff --check` plus requirement-level review and G1–G5.
  - **Integration gate:** G1–G5. **Depends-on:** T8. **Risk:** high. **Known gotchas:** real model output is not evidenced by the deterministic provider; no passing claim without exit/result evidence.
  - **Acceptance:** completion report maps every AC to current code and fresh evidence, explicitly identifies any unavailable gates, and reports security findings and their resolution.

## Testing strategy

- **G1 reviewer-core:** `cd reviewer-core && npm run typecheck && npm test` after T4; server consumer typecheck is included in G2.
- **G2 server:** `cd server && pnpm typecheck && pnpm exec vitest run --exclude '**/*.it.test.ts'` plus `pnpm exec vitest run test/onboarding.it.test.ts` against Docker. The integration file must test a clean full migration chain and upgrade from an old populated database, scoped read/write, lease races and persistence. Record each command separately.
- **G3 client:** `cd client && pnpm typecheck && pnpm test && pnpm build`; build is required for the new App Router route. Run after the hermetic runner has stopped modifying Next-generated types.
- **G4 E2E:** `cd e2e && npm run typecheck`, then from root `E2E_FLOW=14-onboarding-tour.flow.json ./scripts/e2e.sh`; run the full hermetic suite once if the fixture/runner changes affect other flows. Preserve Next generated files and unrelated worktree changes.
- **G5 demonstration:** in an authorized configured workspace, explicitly generate once on a representative repository, inspect five sections, evidence, index freshness and actual call count/cost on page and safe operational logs. Record provider/model, outcome and available usage without repository contents or secrets. This may incur provider charges; an absent provider or inability to run is reported as not evidenced. Fixture E2E is not a substitute.
- Before implementation, run the local plan-verifier in preflight mode on this plan after approval; in completion mode supply changed-file manifest and fresh receipts. Do not count the planned commands above as execution results.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Model fabricates claims even with valid citations | Constrain displayed factual statements to validated typed facts/templates; discard unsupported structured output, show skeleton. |
| Budget or selection differs from sent payload | Share canonical serializer and estimate its framing; deterministic tests at exact limits. |
| Expired worker overwrites later generation | Database admission, lease, fencing token and transactional finalization, tested across competing workers. |
| Index SHA differs from checkout or changes during generation | Capture immutable revision; attribute result to it, compare only to current indexed revision, otherwise mark freshness unknown. |
| Security or privacy regression in path/Markdown handling | Workspace-scoped resolution, immutable blob reads or safe existing file policy, no arbitrary URL/HTML, adversarial tests and security review. |
| Large migration or existing legacy onboarding row | New immutable migration, preserve legacy data, test clean and upgrade paths separately. |
| Demo lacks provider usage or is unavailable | Explicit null and separate real-model evidence; never substitute zero or claim a completed demo. |

## Red-flags check

- AC-1–AC-22 each have task, focused owner and integration gate in the matrix; all work is linear and the dependency graph is acyclic.
- Shared contract copies, source alias typecheck, immutable migrations, both database migration paths, authorization, hermetic browser and separate real-model evidence have explicit owners.
- No specification or product code was edited by planning. User acceptance of the draft and single-agent mode are recorded above.
- The plan is a proposal, not evidence of implementation, test success, visual match, security review, or a real model run.
