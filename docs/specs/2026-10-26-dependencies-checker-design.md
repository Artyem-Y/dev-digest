# Dependencies checker skill

## Goal

Create a project-scoped Codex skill that produces an evidence-backed dependency
report for DevDigest. The report must help developers understand external package
costs and internal component/module coupling, then prioritize actionable work.

## Scope

The skill analyzes every independently managed Node package in this repository:
`client`, `server`, `reviewer-core`, `e2e`, and `mcp`.

It uses package manifests and lockfiles to classify external dependencies as
production, development, optional, or peer; identify direct and transitive
dependencies; identify duplicate resolved versions; and count downstream
packages. It uses source imports and configured TypeScript aliases to build an
internal graph for package, module, and component boundaries.

When the relevant `node_modules` directory exists, the report may include an
observed on-disk size. When it does not exist, the report marks the size as
unavailable. It must not infer archive or installed size from package names or
query a registry without explicit user authorization.

## Deliverable

The Codex skill lives at `.codex/skills/dependencies-checker/` and contains:

- `SKILL.md` with concise triggering criteria, analysis workflow, and safety
  boundaries;
- a deterministic analysis script for repeated parsing and graph construction;
- a reference defining the Markdown and JSON report contracts;
- an eval fixture set and Codex JSONL runner.

The skill produces two artifacts:

- `dependency-report.md` for developers;
- `dependency-report.json` for CI and later comparisons.

## Report contract

Every report contains:

1. Scope, source files, timestamp, and explicit unavailable measurements.
2. A Mermaid package graph and an internal module/component graph, with only
   evidence-backed edges.
3. A dependency table showing package, classification, direct/transitive state,
   resolved version(s), downstream count, observed size or unavailable state,
   and known usage locations.
4. A findings section for import cycles, duplicate versions, cross-package
   imports/aliases, and central modules.
5. A `P0`–`P3` prioritized recommendation list. Each recommendation names its
   evidence, impact, and a bounded next action.

Priority is deterministic: `P0` is a confirmed import cycle or a runtime
cross-package boundary violation; `P1` is a direct production dependency with
material measured transitive weight or confirmed duplicate resolution; `P2` is
a development-only cost or non-blocking coupling concern; `P3` is an
informational improvement. A missing size never promotes a finding.

## Evaluation contract

The eval fixtures model all five packages, mixed dependency kinds, a duplicate
version, an internal cycle, a valid alias edge, and absent `node_modules`.
They contain no explanatory comments about the seeded issues.

The Codex eval runner executes the skill in isolated workspaces and checks the
JSON report deterministically: required sections, expected graph edges,
classification, unavailable size handling, and finding priorities. A separate
structured rubric review checks that Markdown advice is comprehensible and
grounded in the JSON result.

## Non-goals

- Registry, license, vulnerability, or CVE scanning.
- Network access or package installation.
- Bundle-size measurement or production build profiling.
- Automatic dependency upgrades, removals, or edits.
