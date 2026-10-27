# E2E SDD Specifications

This directory contains SDD specifications for changes owned only by the e2e
package. Start with the [e2e README](../../README.md) for current behavior.

Specifications define the proposed user journey, constraints, failure behavior,
accessibility requirements, edge cases, and acceptance criteria. They do not
contain implementation steps or code.

`e2e/specs/*.flow.json` remains the separate location for executable,
deterministic browser flows. Do not place SDD Markdown specifications there.

If a feature affects e2e and any other DevDigest module, place its
specification in the [cross-module SDD directory](../../../docs/specs/README.md).

Use `YYYY-MM-DD-<kebab-feature-name>.md` file names and the corresponding
`SPEC-YYYY-MM-DD-<kebab-feature-name>` identifier.
