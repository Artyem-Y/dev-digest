---
name: devdigest-verification
description: Plan or verify a DevDigest change when test ownership, test-lane selection, and fresh evidence must be explicit without duplicate suite runs.
---

# DevDigest Verification

Use this skill for an implementation plan, a verification matrix, or a
completion review. It assigns evidence to an owner; it does not replace package
instructions or make an unrun command pass.

## Build one traceability matrix

For each specification acceptance criterion or verified requirement, record:

| Requirement | Code owner | Focused check | Integration gate | Evidence receipt | Status |
|---|---|---|---|---|---|

- A leaf implementer owns the narrowest changed-behavior test.
- One integration owner owns each affected package's typecheck and broad suite
  after dependent changes are combined.
- A test writer owns test-only paths and focused test evidence; it must not
  duplicate a package-wide typecheck already owned by the integration gate.
- A plan verifier reads receipts and code evidence. It never upgrades a status
  from a self-report alone.

An evidence receipt contains the command, exit status, scope, revision or
worktree hash, and the paths it covers. Reuse it only when that revision/hash
still matches and later changes cannot affect its covered paths or dependencies.

## Select the smallest valid lane

- Client: run the focused Vitest test for changed behavior; run `pnpm typecheck`
  once at the client integration gate.
- Server: use `pnpm exec vitest run --exclude '**/*.it.test.ts'` for the normal
  hermetic unit lane. Select `pnpm exec vitest run .it.test` only for a changed
  real-Postgres integration boundary and report Docker availability honestly.
- Reviewer core: run the focused Vitest test, then its package typecheck at the
  integration gate. When its source changes, include the server typecheck
  because server consumes it through a source alias.
- E2E: run the hermetic browser lane only when an acceptance criterion changes
  a covered end-to-end journey. It needs the isolated seeded stack and
  `agent-browser`; do not treat an unavailable local browser as a passing test.
- Migrations: verify both an upgrade from an existing database and a clean full
  migration chain. Committed migrations and their metadata are immutable.

Do not use a full package suite merely because a focused test exists. Escalate
the lane when a changed public contract, persistence boundary, shared contract,
or user journey makes the broader evidence necessary.

## Coordinate parallel work

- Give concurrent agents non-overlapping `Owned paths`, including test paths.
- Run a focused test after its owning change; defer package-wide checks until
  its dependencies are merged.
- On a failing gate, identify the requirement and owning task before rerunning.
  Do not repeatedly run broad suites while the same known defect remains.
- Preserve a failed command receipt as evidence; it is not replaced by an
  unrelated passing command.
