---
name: run-plan
description: Execute an approved DevDigest implementation plan with DAG-safe implementers, preflight and completion verification, parallel independent reviews, and a bounded fix loop. Use only after spec authoring and planning are complete.
---

# Run Plan

Run an already-approved implementation plan to reviewed code. You are the main
session coordinator: dispatch specialised agents, retain only their concise
reports, and do not implement or review the feature yourself.

Invoke with:

```text
/run-plan plan:<path> [mode:multi|single] [max-fix:<n>] [free-text constraints]
```

## Inputs and stop conditions

- `plan:<path>` is required. Read it; if it is missing, unreadable, unapproved,
  or lacks task ownership, stop and ask for the exact plan path or correction.
- `mode:multi` or `mode:single` overrides the plan's execution mode. Otherwise
  use the recorded mode.
- `max-fix:<n>` limits remediation iterations; default to `3`.
- Free text is a run constraint, not a change to requirements. If it conflicts
  with the plan, stop for a human decision.

This skill starts from an approved plan. Do not invoke `spec-creator` or
`implementation-planner`, and do not reinterpret supplied designs or feature
requirements. Do not invoke `test-writer`; each implementer owns the tests
assigned to its task.

Never push, merge, open a pull request, or silently continue past a blocking
task. Keep the plan path, task cards, changed-file manifest, and short agent
reports in coordinator context; do not paste full diffs or transcripts.

## Execute the plan

1. Read the plan and extract each task ID, action, module, selected skills,
   owned paths, verification owner, focused check, integration gate,
   dependencies, and acceptance criteria. State the selected mode, task count,
   and fix limit in one line.
2. Run `plan-verifier` in `preflight` mode. If any requirement is `blocked`,
   stop before dispatching code work.
3. In multi-agent mode, dispatch all ready tasks whose dependencies are complete
   and whose owned paths do not overlap, one `implementer` per task. Give each
   task card and the other concurrent tasks' owned paths. Wait for the batch,
   collect short results, then form the next ready set. In single-agent mode,
   dispatch tasks in dependency order.
4. If a task reports a failing or blocked focused check that it cannot resolve
   in scope, stop dependent work and surface the blocker. Do not convert it
   into an unrelated retry.
5. After dependent work is combined, dispatch the plan-designated integration
   owner to run package-wide gates and `pr-self-review`. Record the fresh
   receipts in the Verification Matrix.
6. Run `plan-verifier` in `completion` mode. If it identifies a functional
   requirement gap, put that gap into the remediation backlog before review.
7. After completion verification, dispatch independent reviewers concurrently:
   `architecture-reviewer` always, and `security-reviewer` only when the plan
   or changed paths trigger its scope under the handoff protocol. Pass each a
   compact Review Packet with the completion report; reviewers inspect the
   worktree instead of receiving a pasted full diff.

## Bounded remediation loop

Build a backlog from confirmed completion gaps, `critical`/`high` architecture
or security findings, and any explicitly user-approved lower-severity finding.
Report other findings without silently expanding scope.

For iteration `1..max-fix`:

1. Group backlog items into non-overlapping owned-path fix tasks and dispatch
   `implementer` agents with the exact finding, `path:line` evidence, required
   focused check, and scope boundary.
2. Run the focused checks for those fixes. Re-run the integration gate only if
   its receipt is no longer valid for the changed paths or dependencies.
3. Re-run the affected independent reviewers concurrently on the changed files.
   Re-run completion verification for every requirement whose evidence changed.
4. Stop successfully when no actionable backlog remains. Stop and ask a human
   if the same backlog makes no progress or the fix limit is reached.

## Final report

Return only concise evidence:

```md
## Run Plan — <feature>

- **Plan:** `<path>` — mode: <multi|single>
- **Implemented:** <task IDs and one-line result>
- **Verification:** <focused and integration receipts, or limits>
- **Test Writer:** not invoked by design

### Review gate
- plan-verifier preflight: <ready|blocked>
- plan-verifier completion: <tested N/M; gaps or none>
- architecture-reviewer: <PASS|FAIL; critical/high counts>
- security-reviewer: <not triggered|PASS|FAIL; critical/high counts>

### Fix loop
- iterations run: <n>/<max-fix>
- resolved: <finding IDs or none>
- **remaining (needs human):** <items or none>

### Next step
No push, merge, or PR was performed. Review the result before any external action.
```

## When you cannot proceed

Stop and state the exact blocker when the plan is missing, unreadable,
unapproved, or lacks task ownership; preflight is blocked; an implementer is
blocked on a decision only a human can make; a required focused check cannot be
resolved in scope; the remediation loop makes no progress; or `max-fix` is
reached with actionable findings remaining. A clear blocked result is valid; a
partial run presented as complete is not.
