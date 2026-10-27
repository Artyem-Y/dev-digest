# Dependency report contract

The analyzer emits `schema_version: 1` JSON with these stable fields:

- `packages`: discovered package-manifest workspaces.
- `dependencies`: direct and locally lockfile-resolved transitive dependencies.
  `kind` is one of `production`, `development`, `optional`, `peer`, or
  `transitive`; `downstream_count` counts other local workspaces declaring the
  same direct dependency; installed sizes are either `observed` bytes or
  `unavailable`.
- `internal_edges`: resolved local source imports. Each edge gives `from`, `to`,
  and the source `via` specifier.
- `cycles`: strongly connected local-import components.
- `duplicates`: locally observed package names with more than one lockfile
  version.
- `recommendations`: deterministic evidence, impact, and bounded next action.

The Markdown rendering contains package and module Mermaid graphs, a dependency
inventory, explicit unavailable measurements, and the recommendation table.

## Priority rules

- **P0:** a confirmed internal import cycle or confirmed runtime cross-package
  boundary violation.
- **P1:** a direct production dependency with material observed transitive
  weight or a confirmed duplicate resolution.
- **P2:** a development-only cost or non-blocking coupling concern.
- **P3:** inventory information that does not warrant a corrective action.

Missing measurements never increase a priority. Every recommendation must cite
paths or resolved-version evidence from the JSON report.
