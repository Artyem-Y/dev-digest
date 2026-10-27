# Public evaluation report contract

Write both files below relative to the repository root:

- `result/dependency-report.json`
- `result/dependency-report.md`

The JSON is an object with `schema_version: 1` and these fields:

- `packages`: objects identifying each workspace with a `workspace` field.
- `dependencies`: objects with `workspace`, `package`, `kind`, and
  `size_status`. `kind` is `production`, `development`, `optional`, `peer`, or
  `transitive`; `size_status` is `observed` or `unavailable`.
- `internal_edges`: resolved local imports with `from`, `to`, and `via`.
- `cycles`: import-cycle objects with a `members` array.
- `duplicates`: resolved-version duplicates with `package` and `versions`.
- `recommendations`: actionable findings with `priority`, `kind`, and evidence.

The Markdown must explain the same evidence for developers. Include package and
module Mermaid graphs, an inventory, unavailable measurements when applicable,
and a prioritized recommendation table. Do not infer a package size when it
cannot be measured locally.
