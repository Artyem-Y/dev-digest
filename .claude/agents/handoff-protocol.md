# Agent Handoff Protocol

Use this protocol between DevDigest agents to reduce repeated context while
preserving evidence and verification boundaries. It does not replace required
package instructions or Engineering Insights reads.

## Shared context manifest

The coordinator creates one manifest per change. It contains the approved plan
path and hash, affected packages, relevant local-skill names, base/current
revision or worktree state, changed-file list, and a receipt for commands
already run. Reference the manifest; do not paste its source documents or the
full diff into another handoff.

## Compact artifacts

| Artifact | Producer | Maximum content |
|---|---|---|
| Research Bundle | researcher | Question, conclusions, evidence table, constraints, unknowns; no raw search transcript. |
| Task Card | implementation-planner | One bounded outcome, files/symbols, invariants, skills, focused checks, dependencies. |
| Verification Matrix | implementer | Requirement, command, exit status, scope, evidence location, unverified reason. |
| Review Packet | coordinator | Context manifest plus changed-file and verification-matrix references. Reviewers inspect the working tree directly. |

## Dispatch rules

1. Do not dispatch research for a mechanical repository inventory; implementation-planner or
   implementer gathers it locally.
2. Run independent research in parallel only when it changes a decision.
3. Run `plan-verifier` in `preflight` mode after the implementation plan and
   before dispatching implementation. Resolve blocked traceability, owned-path,
   and verification gaps first.
4. Execute dependent task cards sequentially with one implementer. Do not
   start another implementer on overlapping files or test paths. A
   plan-designated integration owner runs package-wide gates after dependent
   work is combined; leaf implementers keep to focused checks.
5. Always run `plan-verifier` in `completion` mode after material
   implementation and its integration gate. Remediate functional gaps before
   independent reviews.
6. Add `architecture-reviewer` for a new/changed module boundary, DI, external
   adapter, shared contract, migration, or cross-package change. Add
   `security-reviewer` for untrusted input, authorization, secret handling,
   rendered external/model content, outbound network/tool access, or a
   dependency change. The two reviews may run in parallel once completion is
   evidenced.
7. After a finding is fixed, rerun the finding's focused check and the affected
   independent review; rerun completion verification when the fix changes a
   requirement's evidence. Do not dispatch documentation before these known
   gaps are resolved or explicitly deferred.
8. Use the least capable approved model for inventory, manifest assembly,
   mechanical comparison, and command-result normalization. Reserve Terra or
   an equivalent high-capability model for external research, architecture,
   and ambiguous cross-package judgment. Keep an agent's configured model when
   it is explicitly required.

## Diff and evidence rules

- Pass revision references, changed paths, and exact hunk/line pointers—not a
  pasted full diff. A reviewer reads only those paths plus direct callers,
  contracts, and persistence boundaries.
- Command output is referenced by command, exit status, summary, and saved
  location when available. Never reproduce long successful output.
- A cached artifact is valid only when its path/hash matches the current
  worktree. If it differs, regenerate only that artifact.
- `INSIGHTS.md`, package instructions, and any evidence necessary for a
  conclusion remain mandatory reads under their own rules.
