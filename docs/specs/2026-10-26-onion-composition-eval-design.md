# Onion Architecture composition-boundary eval

## Goal

Prove that a revised Codex Onion Architecture skill detects a module-composition
violation that the current version does not explicitly require reviewers to
report.

## Scope

The revised skill adds one rule for new or substantially changed DevDigest server
modules: a module composition factory constructs concrete repositories, services,
and adapters; its route only obtains request context and invokes the assembled
application API. A route must not instantiate a concrete service or repository
and must not read the DI container directly.

The rule requires a composition-path trace, not a single import check. For each
changed route, job, or SSE handler, the reviewer follows imported local helpers
and factory calls until it reaches either an application-facing API or concrete
composition. It accepts a handler that delegates to its module composition
factory, but reports a handler or helper on its request path that reaches into
`Container`, `container.db`, Drizzle, or constructs a concrete repository or
service outside composition.

This is a review constraint for newly created or substantially changed paths. It
does not require a broad rewrite of legacy routes outside the task boundary.

## Evaluation contract

The eval uses one larger clean server-module diff fixture. It includes a route,
an SSE handler, an application service, a correct module composition factory,
and a local helper. The route appears to delegate, but the helper on its request
path reads `container.db` and constructs a concrete repository and service.
The SSE handler and composition factory use the intended boundary so the skill
must identify the hidden route-path violation without reporting those correct
paths. The fixture contains no comments or labels that identify the issue.

Ten isolated Codex runs receive the same prompt and fixture:

1. Five baseline runs receive a snapshot of the current Onion Architecture skill.
2. Five candidate runs receive the revised skill.

Neither run receives the expected result. A post-run grader receives the
expected result and scores whether the response identifies the direct
route-to-composition violation with a changed file/line citation. The runner
also captures JSONL traces, duration, and token usage. The aggregate reports
mean, minimum, maximum, and standard deviation for each arm and their delta.

## Acceptance criteria

- The baseline and candidate start from separate clean workspaces.
- The fixture is identical in both runs and contains no explanatory comments.
- The candidate skill explicitly requires module composition factories and
  composition-path tracing through local helpers; it forbids direct or hidden
  `Container` use and concrete construction outside composition.
- The candidate identifies the fixture's hidden composition-boundary violation
  with a citation to the changed route-path line and does not report the
  compliant SSE or composition paths.
- Each arm runs five times in separate clean workspaces.
- Results report matching findings, false positives, duration, tokens, and the
  candidate-minus-baseline delta, with mean, minimum, maximum, and standard
  deviation per arm.
- The evaluation uses `codex exec --json`; expected results are available only
  to the grader after each review run completes.

## Non-goals

- Refactoring production server modules.
- Changing the existing `.claude` skill delivery format.
- Treating an LLM judge as a replacement for deterministic file and citation
  checks.
