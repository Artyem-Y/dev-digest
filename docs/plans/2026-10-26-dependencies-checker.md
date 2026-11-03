# Dependencies Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-scoped Codex skill that generates evidence-backed Markdown and JSON dependency reports, with repeatable baseline-versus-skill eval automation.

**Architecture:** The skill instructs Codex to invoke a deterministic Node ESM analyzer. The analyzer reads manifests, lockfiles, tsconfig aliases, and TypeScript imports to emit a canonical JSON report and Markdown renderer. A separate eval runner creates fresh baseline and candidate sandboxes, captures `codex exec --json` traces, grades generated reports, and aggregates five runs per arm.

**Tech Stack:** Node.js ESM, built-in `node:test`, filesystem APIs, `codex exec --json`, Markdown, Mermaid.

---

## File structure

- `.codex/skills/dependencies-checker/SKILL.md` — trigger criteria and safe operator workflow.
- `.codex/skills/dependencies-checker/references/report-contract.md` — report fields, graph semantics, and priority rules.
- `.codex/skills/dependencies-checker/scripts/analyze-dependencies.mjs` — deterministic collector, graph builder, priority engine, and report renderer.
- `.codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs` — unit tests for classification, graph cycles, size absence, duplicates, priorities, and report rendering.
- `.codex/skills/dependencies-checker/evals/fixtures/repo/` — synthetic five-package repository fixture without issue-revealing comments.
- `.codex/skills/dependencies-checker/evals/expected.json` — post-run oracle, separate from the fixture.
- `.codex/skills/dependencies-checker/evals/grade-report.mjs` — deterministic report/oracle matcher.
- `.codex/skills/dependencies-checker/evals/run-evals.mjs` — five-run baseline/candidate executor and benchmark writer.
- `.codex/skills/dependencies-checker/evals/rubric.schema.json` — structured schema for optional read-only qualitative grading.

### Task 1: Write analyzer tests and fixture repository

**Files:**
- Create: `.codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`
- Create: `.codex/skills/dependencies-checker/evals/fixtures/repo/{client,server,reviewer-core,e2e,mcp}/package.json`
- Create: `.codex/skills/dependencies-checker/evals/fixtures/repo/{client,server,reviewer-core,e2e,mcp}/package-lock.json`
- Create: `.codex/skills/dependencies-checker/evals/fixtures/repo/server/tsconfig.json`
- Create: `.codex/skills/dependencies-checker/evals/fixtures/repo/server/src/{modules/billing/routes.ts,modules/billing/service.ts,modules/billing/repository.ts,modules/billing/summary.ts}`

- [ ] **Step 1: Write tests for a canonical report shape**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRepository, renderMarkdown } from './analyze-dependencies.mjs';

test('classifies direct dependency kinds and leaves absent installed sizes unavailable', async () => {
  const report = await analyzeRepository(fixtureRoot);
  const runtime = report.dependencies.find((item) => item.package === 'fastify');
  assert.deepEqual(runtime.kind, 'production');
  assert.equal(runtime.size_bytes, null);
  assert.equal(runtime.size_status, 'unavailable');
});
```

- [ ] **Step 2: Run the test and verify the expected missing-module failure**

Run: `node --test .codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`

Expected: failure because `analyze-dependencies.mjs` does not yet exist.

- [ ] **Step 3: Add fixture facts that exercise all report dimensions**

Create manifests and lockfiles that include `fastify` as a production dependency,
`vitest` as a development dependency, an optional dependency, a peer dependency,
and two different resolved versions of one transitive package. Add imports that
form `routes -> service -> repository -> summary -> service` plus one `@billing/*`
alias edge. Do not put comments in source or fixture metadata describing cycles,
duplicates, or priorities.

- [ ] **Step 4: Expand failing tests for graph and priority behavior**

```js
test('reports an internal import cycle and makes it P0', async () => {
  const report = await analyzeRepository(fixtureRoot);
  assert.deepEqual(report.cycles[0].members, [
    'server/src/modules/billing/service.ts',
    'server/src/modules/billing/summary.ts',
  ]);
  assert.equal(report.recommendations[0].priority, 'P0');
});

test('renders Mermaid and a JSON-grounded recommendation table', async () => {
  const markdown = renderMarkdown(await analyzeRepository(fixtureRoot));
  assert.match(markdown, /```mermaid/);
  assert.match(markdown, /\| Priority \| Evidence \| Impact \| Next action \|/);
});
```

### Task 2: Implement the deterministic analyzer

**Files:**
- Create: `.codex/skills/dependencies-checker/scripts/analyze-dependencies.mjs`
- Modify: `.codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`

- [ ] **Step 1: Implement pure manifest and lockfile collectors**

Export `analyzeRepository(root)`, `renderMarkdown(report)`, and a CLI entrypoint.
Discover only package directories with a `package.json`; parse dependency kinds
from the manifest; resolve lockfile facts locally; represent unavailable fields as
`null` plus a status field rather than guessed values.

- [ ] **Step 2: Run unit tests and verify they pass**

Run: `node --test .codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`

Expected: all tests pass.

- [ ] **Step 3: Add TypeScript import graph collection**

Walk `.ts` and `.tsx` source files while excluding `node_modules`, generated
artifacts, and test snapshots. Resolve relative imports and configured path aliases
within their package. Return only resolved internal edges, strongly connected
components, and package-to-package edges.

- [ ] **Step 4: Add deterministic priority calculation and report renderers**

Implement the four priority classes in the approved spec. Render package and
internal Mermaid graphs, tabular dependency facts, unavailable-size declarations,
and one evidence/impact/action row for every recommendation. The CLI accepts:

```sh
node scripts/analyze-dependencies.mjs \
  --root /absolute/repository/path \
  --json /absolute/output/dependency-report.json \
  --markdown /absolute/output/dependency-report.md
```

- [ ] **Step 5: Run the full unit test suite again**

Run: `node --test .codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`

Expected: all tests pass after import graph and renderer additions.

### Task 3: Create the Codex skill and report contract

**Files:**
- Create: `.codex/skills/dependencies-checker/SKILL.md`
- Create: `.codex/skills/dependencies-checker/references/report-contract.md`

- [ ] **Step 1: Write skill behavior before the implementation reference**

The skill must trigger for dependency, package-weight, internal-coupling, import
graph, and dependency-prioritization requests. It must run the analyzer before
making claims; never install packages, query registries, or change dependencies;
and distinguish observed size from unavailable size.

- [ ] **Step 2: Define the JSON and Markdown contract**

Specify `packages`, `dependencies`, `internal_edges`, `cycles`, `duplicates`,
`recommendations`, and measurement status fields. Require evidence file paths for
each recommendation and define `P0` through `P3` exactly as the approved spec.

- [ ] **Step 3: Validate the skill directory**

Run: `python3 /Users/artem/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/dependencies-checker`

Expected: validation succeeds with no unfinished scaffold markers.

### Task 4: Build deterministic eval grading

**Files:**
- Create: `.codex/skills/dependencies-checker/evals/expected.json`
- Create: `.codex/skills/dependencies-checker/evals/grade-report.mjs`
- Create: `.codex/skills/dependencies-checker/evals/rubric.schema.json`

- [ ] **Step 1: Write failing grader tests in the analyzer test file**

```js
test('grader accepts the expected fixture report and rejects a missing P0 cycle', async () => {
  const report = await analyzeRepository(fixtureRoot);
  const expected = JSON.parse(await readFile(expectedPath, 'utf8'));
  assert.equal(gradeReport(report, expected).pass, true);
  assert.equal(gradeReport({ ...report, cycles: [] }, expected).pass, false);
});
```

- [ ] **Step 2: Run the test and verify it fails because the grader is absent**

Run: `node --test .codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`

Expected: failure because `grade-report.mjs` does not export `gradeReport`.

- [ ] **Step 3: Implement oracle matching and rubric schema**

The oracle asserts required package names, dependency classifications, one cycle,
one duplicate, one alias edge, unavailable installed size, and priority order.
`gradeReport` returns per-assertion evidence, totals, precision/recall for required
findings, and a boolean pass. The rubric schema requires `overall_pass`,
`score`, and per-check notes for a later read-only judge.

- [ ] **Step 4: Run the grader test and verify it passes**

Run: `node --test .codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`

Expected: all tests pass.

### Task 5: Implement five-run baseline/candidate automation

**Files:**
- Create: `.codex/skills/dependencies-checker/evals/run-evals.mjs`
- Create: `.codex/skills/dependencies-checker/evals/prompt.txt`

- [ ] **Step 1: Write runner unit tests for workspace isolation and aggregation**

```js
test('aggregate produces statistics for five baseline and five candidate runs', () => {
  const benchmark = aggregate({ baseline: fiveRuns, candidate: fiveRuns });
  assert.equal(benchmark.baseline.runs, 5);
  assert.equal(benchmark.candidate.runs, 5);
  assert.ok(Number.isFinite(benchmark.delta.pass_rate));
  assert.ok(Number.isFinite(benchmark.candidate.tokens.stddev));
});
```

- [ ] **Step 2: Run the test and verify it fails because the runner is absent**

Run: `node --test .codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`

Expected: failure because `run-evals.mjs` does not export `aggregate`.

- [ ] **Step 3: Implement isolated arms**

For every run, copy the fixture repository to a new temporary directory. The
baseline workspace must not contain a discoverable `dependencies-checker` skill;
the candidate workspace contains only the candidate snapshot under
`.codex/skills/dependencies-checker/`. Run the same task with `codex exec --json`;
the candidate prompt explicitly requests `$dependencies-checker`. Capture each
JSONL stream, generated reports, exit status, elapsed duration, and token totals.

- [ ] **Step 4: Implement grading and benchmark output**

Invoke `gradeReport` after each run, calculate pass rate, token and duration
mean/min/max/stddev for five runs in each arm, then persist `benchmark.json`.
Do not label an unchanged or negative delta as an improvement.

- [ ] **Step 5: Run deterministic runner tests**

Run: `node --test .codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`

Expected: all tests pass without calling a model.

- [ ] **Step 6: Run the live ten-run comparison**

Run: `node .codex/skills/dependencies-checker/evals/run-evals.mjs --runs 5 --output /private/tmp/dependencies-checker-eval`

Expected: five completed baseline runs, five completed candidate runs, JSONL traces,
per-run grades, and one `benchmark.json`. Report model-call or authentication
failures as unverified; do not replace them with fabricated scores.

### Task 6: Final verification and handoff

**Files:**
- Verify: every path created above

- [ ] **Step 1: Run skill validator**

Run: `python3 /Users/artem/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/dependencies-checker`

Expected: success.

- [ ] **Step 2: Run all deterministic tests**

Run: `node --test .codex/skills/dependencies-checker/scripts/analyze-dependencies.test.mjs`

Expected: all tests pass.

- [ ] **Step 3: Inspect generated report and benchmark artifacts**

Run: `node .codex/skills/dependencies-checker/scripts/analyze-dependencies.mjs --root . --json /private/tmp/dependency-report.json --markdown /private/tmp/dependency-report.md`

Expected: both artifacts exist, identify every package in scope, and mark every
unmeasured installed size as unavailable.

- [ ] **Step 4: Inspect final worktree state**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; report only this task's files and preserve all
pre-existing untracked work.
