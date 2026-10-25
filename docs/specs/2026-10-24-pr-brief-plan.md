# PR Brief implementation plan

**Spec:** [PR Why + Risk Brief](2026-10-24-pr-brief.md)  
**Status:** implementation record and execution plan  
**Scope:** `server`, `reviewer-core`, `client`, and hermetic `e2e`

## Outcome

Add a PR-scoped, SHA-aware cached Brief to Overview. A user explicitly
generates it; the model receives bounded, already-grounded facts rather than
raw diff hunks. The result contains a summary, file-backed risk areas, and
review-focus targets that can open Files changed. Cached data remains usable
after reload and is regenerated only on explicit user action.

## Constraints

- Preserve workspace and PR authorization at every Brief endpoint.
- The provider never receives raw diff hunks, secrets, run traces, or arbitrary
  repository files.
- Treat provider output as untrusted: persist only schema-valid, changed-file
  references and positive line numbers.
- Limit one generation in flight per PR and account for the complete
  system-plus-user prompt within the 8,000-token ceiling.
- Keep `@devdigest/shared` Brief contracts identical in both vendored copies.
- Do not add Project Context document editing; consume only the approved,
  tracked attachments described by the Project Context specification.

## Implementation sequence

### 1. Define and synchronize the Brief contract

**Files**

- `server/src/vendor/shared/contracts/brief.ts`
- `client/src/vendor/shared/contracts/brief.ts`
- `server/src/vendor/shared/contracts/review-api.ts`
- `client/src/vendor/shared/contracts/review-api.ts`

**Work**

1. Define the strict Brief cache shape: summary, risks, review-focus file/line
   targets, Intent, Blast Radius, history, head SHA, cache state, and source
   provenance/status.
2. Make source availability explicit (`used`, `unavailable`, or rejected) so a
   client can distinguish missing enrichment from a successful empty result.
3. Validate all response and persisted JSON at the shared contract boundary.
4. Compare the vendored server/client files byte-for-byte before merging.

**Verification**

```sh
cmp -s server/src/vendor/shared/contracts/brief.ts client/src/vendor/shared/contracts/brief.ts
cmp -s server/src/vendor/shared/contracts/review-api.ts client/src/vendor/shared/contracts/review-api.ts
```

Both commands must exit `0`.

### 2. Persist a SHA-aware, workspace-scoped cache

**Files**

- `server/src/db/schema.ts`
- `server/src/db/migrations/` (a newly generated Brief migration)
- `server/src/db/migrations/meta/` (the metadata generated with that migration)
- `server/src/modules/brief/repository.ts`
- `server/src/modules/brief/application/generate-brief.ts`
- `server/test/brief*.test.ts`

**Work**

1. Generate a new Drizzle migration for the Brief cache; do not edit an
   existing migration or its metadata.
2. Key cache reads and writes by workspace and PR, store the source head SHA,
   and return `current`, `stale`, or absent state deterministically.
3. On a repeated request for the same SHA, return the persisted cache without a
   provider call. Mark an old SHA stale, but retain it for display until the
   user chooses regeneration.
4. Reserve a generation slot transactionally; return a typed
   `brief_generation_in_progress` response for a concurrent request.

**Verification**

```sh
cd server && pnpm exec vitest run test/brief-cache.test.ts test/brief-generation.test.ts
cd server && pnpm typecheck
```

Add cases for cache hit, SHA change, concurrent generation, workspace
isolation, and invalid persisted payload rejection. If persistence changes,
also run the project’s clean-chain migration and upgrade-path checks.

### 3. Assemble only bounded, grounded input for the provider

**Files**

- `server/src/modules/brief/application/generate-brief.ts`
- `server/src/modules/brief/domain/filter-output.ts`
- `reviewer-core/src/brief.ts`
- `reviewer-core/test/brief.test.ts`
- `server/test/brief-budget.test.ts`

**Work**

1. Collect already-derived PR metadata, Intent, Blast Radius, Smart Diff,
   permitted Project Context attachments, and changed-file paths.
2. Build the canonical Brief prompt in `reviewer-core`; exclude raw diff hunks
   and account for the trusted system framing and user serialization together.
3. Enforce the 8,000-token admission limit before calling the provider.
4. Parse provider output, then filter every risk reference and review-focus
   target against the changed-file allow-list and positive-line rule before
   persistence.
5. Preserve source statuses when an optional fact is unavailable; never replace
   unavailable data with a claim that the lookup succeeded with no result.

**Verification**

```sh
cd reviewer-core && npm test && npm run typecheck
cd server && pnpm exec vitest run test/brief-budget.test.ts test/brief-filter-output.test.ts
```

Tests must prove that a raw diff string is absent from the provider request,
the full prompt is within budget, traversal/unmatched paths are discarded, and
an unavailable optional source remains distinguishable from an empty result.

### 4. Expose authorized read and explicit-generation endpoints

**Files**

- `server/src/modules/brief/routes.ts`
- `server/src/modules/brief/composition.ts`
- `server/src/modules/brief/index.ts`
- `server/test/brief-routes.test.ts`

**Work**

1. Add workspace-scoped `GET` and explicit `POST` endpoints for the Brief.
2. Resolve the PR through the existing workspace route context before reading
   or generating a cache entry.
3. Return typed cache and source metadata; do not return prompt text, provider
   request data, or secrets.
4. Map in-progress, budget, validation, and provider errors to existing API
   error conventions.

**Verification**

```sh
cd server && pnpm exec vitest run test/brief-routes.test.ts
cd server && pnpm typecheck
```

Cover another-workspace access, repeated POST cache behavior, in-progress
generation, malformed provider output, and unavailable optional sources.

### 5. Render the Overview Brief and truthful source states

**Files**

- `client/src/lib/hooks/brief.ts`
- `client/src/app/repos/[repoId]/pulls/[number]/_components/PRDetailView/PRDetailView.tsx`
- `client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/OverviewTab.tsx`
- `client/src/app/repos/[repoId]/pulls/[number]/_components/PRBriefCard/PRBriefCard.tsx`
- `client/messages/en/brief.json`
- corresponding `*.test.tsx` files

**Work**

1. Fetch the Brief only for Overview and render empty, loading, generating,
   current, stale, and error states with a visible explicit Generate/Regenerate
   action.
2. Render summary, risk areas, and review focus as separate Overview regions.
   Use React text nodes for model-derived strings; do not add HTML rendering.
3. Prefer live Intent/Blast data when available. If the Brief source metadata
   says either was unavailable, display a source-specific unavailable message
   instead of an empty cached placeholder.
4. Surface the persisted Brief immediately after a reload without issuing a
   second generation request.

**Verification**

```sh
cd client && pnpm exec vitest run \
  'src/app/repos/[repoId]/pulls/[number]/_components/PRBriefCard/PRBriefCard.test.tsx' \
  'src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/OverviewTab.test.tsx'
cd client && pnpm typecheck
```

Cover current/stale cache rendering, successful generation, unavailable Intent,
unavailable Blast Radius, and no empty-quotation fallback.

### 6. Make Review focus routeable and validate its target

**Files**

- `client/src/app/repos/[repoId]/pulls/[number]/_components/PRDetailView/PRDetailView.tsx`
- `client/src/app/repos/[repoId]/pulls/[number]/_components/PRBriefCard/PRBriefCard.tsx`
- `client/src/app/repos/[repoId]/pulls/[number]/_components/DiffTab/DiffTab.tsx`
- `client/src/components/diff-viewer/DiffViewer/DiffViewer.tsx`
- `client/src/components/diff-viewer/FileCard/FileCard.tsx`
- focused component tests

**Work**

1. Render each focus target as a PR-local link carrying `tab=diff`, file, and
   line query parameters.
2. On load, accept a target only when its line is a positive integer and its
   path exactly matches a file in the current PR; otherwise render the normal
   diff without focusing anything.
3. Reveal the valid target file and highlight its line when the patch contains
   it. Do not create an invented anchor when the line is absent.
4. Keep the legacy in-memory callback available for component-only consumers.

**Verification**

```sh
cd client && pnpm exec vitest run \
  'src/app/repos/[repoId]/pulls/[number]/_components/PRBriefCard/PRBriefCard.test.tsx' \
  'src/app/repos/[repoId]/pulls/[number]/_components/DiffTab/brief-focus.test.ts'
```

Cover valid navigation, invalid path, zero/negative/non-integer line, and the
file-reveal behavior after a direct page load.

### 7. Prove the user flow in a hermetic browser run

**Files**

- `server/src/adapters/llm/e2e-brief-fixture.ts`
- `e2e/specs/11-pr-brief.flow.json`
- `e2e/specs/10-smart-diff.flow.json`
- `scripts/e2e.sh`

**Work**

1. Keep the deterministic Brief fixture behind the hermetic test attestation;
   it must not be selectable in development or production.
2. In flow 11, prove empty state, Generate brief, rendered summary/risk/focus,
   focus navigation to Files changed, and persisted Brief after reload.
3. Make viewport-dependent checks explicit: wait for detail data and scroll the
   target region into view before interacting with it.
4. Keep E2E data isolated in the script-created database.

**Verification**

```sh
./scripts/e2e.sh
cd e2e && npm run typecheck
```

Expected result: all flows pass, including the mutation-only Brief flow. Never
claim browser acceptance without this hermetic execution.

## Completion gate

Before opening a PR:

1. Run focused tests, then typecheck in every affected package.
2. Run `./scripts/e2e.sh` and record its pass count.
3. Confirm both shared contract pairs compare equal and run `git diff --check`.
4. Run completion-mode plan verification against this plan and the approved
   spec. Attach its report to the PR description or commit it under
   `docs/specs/` when the team wants durable in-repository evidence.
5. Run architecture and security review for changed boundaries. The security
   review must specifically cover authorization, prompt data minimization,
   untrusted provider output, and query-param focus validation.
