# Onion Architecture skill evals

This folder contains the primary regression cases for the `onion-architecture` skill. Fixtures are ordinary code diffs with no comments or labels revealing the seeded issues.

Machine-readable case list: [`evals.json`](evals.json). Each case points to a fixture diff and a separate expected-output file. Keep expected findings out of prompts and fixture files; the runner loads them only as grading criteria.

## Running the comparison

From the repository root, run the shared Codex eval harness:

```bash
cd evals
EVAL_BACKEND=codex pnpm eval:benchmark skills/onion-architecture -n 1
```

The harness runs the same prompt and fixture in two arms: baseline without the skill and candidate with the skill. It loads the skill entrypoint, `references.md`, and `rules/*.md`; the `evals/` folder is not included in the model's skill payload. Keep the baseline isolated from the skill folder and other architecture rule sources.

## Cases

The first three cases expect three findings each; the tenant-scoping and outbox-lifecycle cases expect three each, and the transactional-effects and peer-schema-import cases check a focused finding. Findings require citations to changed lines. Equivalent wording is acceptable, but claims must be supported by the diff.

### 1. Billing invoice creation

**Fixture:** [`fixtures/01-billing-invoice/change.diff`](fixtures/01-billing-invoice/change.diff)

**Prompt:** Review the proposed backend change for Onion Architecture concerns. Report each concrete issue with file and changed-line citations. Include only issues supported by the diff.

**Expected findings:**

- The application use case imports Fastify's request type. Replace the adapter-owned type with an application-owned input type.
- The application use case imports Drizzle schema and writes directly to the database. Put persistence behind an application-owned port implemented in infrastructure.
- The use case returns a raw Drizzle row instead of an application-owned result mapped at the persistence boundary.

### 2. Repository synchronization

**Fixture:** [`fixtures/02-repository-sync/change.diff`](fixtures/02-repository-sync/change.diff)

**Prompt:** Review the proposed backend change for Onion Architecture concerns. Report each concrete issue with file and changed-line citations. Include only issues supported by the diff.

**Expected findings:**

- The application use case imports and constructs the concrete Octokit SDK. Define an application-owned port and inject its implementation at composition.
- The application package imports Drizzle and exposes a database row type as its contract. Keep application types independent of persistence representation.
- The use case returns an infrastructure row shape instead of an application-owned result mapped at the repository boundary.

### 3. Catalog credentials

**Fixture:** [`fixtures/03-catalog-credentials/change.diff`](fixtures/03-catalog-credentials/change.diff)

**Prompt:** Review the proposed backend change for Onion Architecture concerns. Report each concrete issue with file and changed-line citations. Include only issues supported by the diff.

**Expected findings:**

- The infrastructure repository imports Fastify's reply type, creating a dependency from an outbound persistence adapter to the inbound HTTP adapter.
- The repository handles HTTP status and serialization. Return data and let the route map it to HTTP.
- A provider access token is modeled as a domain value. Keep secrets out of domain values and within the provider/secrets boundary.

### 4. Tenant scoping across repository operations

**Fixture:** [`fixtures/04-tenant-scoping/change.diff`](fixtures/04-tenant-scoping/change.diff)

**Prompt:** Review the proposed backend change for Onion Architecture concerns. Report each concrete issue with file and changed-line citations. Include only issues supported by the diff.

**Expected findings:**

- `getProject` receives a workspace ID but does not scope the read query by workspace.
- `listProjects` receives a workspace ID but does not scope the list query by workspace.
- `renameProject` receives a workspace ID but does not scope the update predicate by workspace.

This case covers the more explicit tenant-scoping rule added after `v1.1.0`. The old version already contains a general instruction to scope tenant reads and writes, so an initial single-run comparison scored both versions equally; keep this as a regression case, not the discriminating version-comparison case.

### 5. External effect inside a transaction

**Fixture:** [`fixtures/05-transactional-side-effect/change.diff`](fixtures/05-transactional-side-effect/change.diff)

**Prompt:** Review the proposed backend change for Onion Architecture concerns. Report each concrete issue with file and changed-line citations. Include only issues supported by the diff.

**Expected finding:** `activateSubscription` publishes a remote billing event inside a database transaction. The external effect cannot roll back if the database commit fails; recommend an outbox and explicitly note that consumers must be idempotent because delivery may repeat, or explain failure handling for a best-effort post-commit call.

This is the discriminating old-versus-new case: `v1.1.0` covers keeping transaction mechanics in infrastructure, but does not state the external-effect/commit boundary or outbox remedy.

### 6. Outbox lifecycle across modules

**Fixture:** [`fixtures/06-outbox-lifecycle/change.diff`](fixtures/06-outbox-lifecycle/change.diff)

**Prompt:** Review the proposed backend change for architectural concerns. Trace the event flow across the changed files and report each concrete issue with file and changed-line citations. Include only issues supported by the diff.

**Expected findings:**

- The business update commits before the separate outbox insert, so the business state and event are not atomic.
- The outbox repository marks an event published before the worker sends it, so provider failure loses the event.
- The event handler increments credits without deduplicating by event ID, so redelivery can apply the effect more than once.

This larger case exercises the new transaction/outbox guidance across application, repository, worker, and consumer files.

### 7. Cross-module private schema import

**Fixture:** [`fixtures/07-peer-schema-import/change.diff`](fixtures/07-peer-schema-import/change.diff)

**Prompt:** Review the proposed backend change for architectural concerns. Report each concrete issue with file and changed-line citations. Include only issues supported by the diff.

**Expected finding:** The reports module imports billing's private Drizzle `invoices` table and joins it directly. Recommend a billing application-facing API or an explicitly owned cross-module read contract/port.

This is the discriminating old-versus-new case. The v1.1.0 dependency rule requires a facade/port for cross-module calls and forbids reaching into another module's repository implementation, but does not explicitly prohibit importing a peer module's private schema from infrastructure. The new rule makes schema ownership explicit.

### Comparing the old and new skill versions

The baseline snapshot is in [`versions/v1.1.0/`](versions/v1.1.0/). Candidate uses the current skill folder. Run the peer-schema-import case to measure the new schema-ownership guidance absent from the old version:

```bash
cd evals
EVAL_BACKEND=codex \
EVAL_BASELINE_SKILL_DIR=.claude/skills/onion-architecture/evals/versions/v1.1.0 \
pnpm eval:benchmark skills/onion-architecture -t "peer module schema" -n 5
```

## Case maintenance

- Add or edit primary scenarios in `evals.json` and keep each fixture free of explanatory comments about seeded issues.
- Keep each fixture's oracle in its adjacent `expected.json`, with stable finding IDs and accurate changed-line anchors.
- The executable Codex harness lives in [`evals/skills/onion-architecture/`](../../../../evals/skills/onion-architecture/); it reads this folder as input without copying cases elsewhere.
- Update this document when cases, prompts, or expected behavior change.
