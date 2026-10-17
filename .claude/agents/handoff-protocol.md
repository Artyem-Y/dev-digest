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
| Task Card | planner | One bounded outcome, files/symbols, invariants, skills, focused checks, dependencies. |
| Verification Matrix | implementer | Requirement, command, exit status, scope, evidence location, unverified reason. |
| Review Packet | coordinator | Context manifest plus changed-file and verification-matrix references. Reviewers inspect the working tree directly. |

## Dispatch rules

1. Do not dispatch research for a mechanical repository inventory; planner or
   implementer gathers it locally.
2. Run independent research in parallel only when it changes a decision.
3. Execute dependent task cards sequentially with one implementer. Do not
   start another implementer on overlapping files.
4. Always run `plan-verifier` after material implementation. Add
   `architecture-reviewer` only for a new/changed module boundary, DI,
   external adapter, shared contract, migration, or cross-package change.
5. Do not dispatch documentation or security review before known functional
   gaps block completion; list the deferred scope instead.
6. Use the least capable approved model for inventory, manifest assembly,
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
