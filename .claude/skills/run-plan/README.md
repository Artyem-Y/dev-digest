# Run Plan Skill

`/run-plan` executes an already-approved DevDigest Implementation Plan. It
coordinates implementers by the plan DAG and owned paths, verifies the result,
and resolves actionable review findings without creating a specification or
plan itself.

## What it does

The command runs in the main session as an orchestrator. It retains only short
agent reports, never writes product code or reviews the change itself, and
never pushes, merges, or opens a pull request.

```text
plan:<path> [mode:multi|single] [max-fix:N]
  -> plan-verifier preflight
  -> implementer tasks by DAG / non-overlapping owned paths
  -> integration owner: package gates + pr-self-review
  -> plan-verifier completion
  -> architecture-reviewer || conditional security-reviewer
  -> bounded fix loop and re-verification
```

## When to invoke

- `/run-plan plan:docs/superpowers/plans/<feature>.md`
- “run the plan”, “execute the plan”, or “implement this plan”.

The specification and Implementation Plan are manual, approved inputs. The
command does not invoke `spec-creator`, `implementation-planner`, or
`test-writer`.

## Guardrails

- Concurrent implementers must have non-overlapping owned paths.
- Preflight must be ready before code work starts.
- Completion verification precedes independent reviews; Architecture Review and
  applicable Security Review run concurrently after that gate.
- The fix loop is capped by `max-fix`; unresolved findings become human
  decisions.
- `pr-self-review` is owned by the integration stage. It does not replace the
  independent reviewers.

## Files

```text
run-plan/
├── SKILL.md     <- orchestration contract
├── tile.json    <- local skill metadata
└── README.md    <- command overview
```
