# Server SDD Specifications

This directory contains SDD specifications for changes owned only by the server
package. Start with the [server README](../../README.md) for current behavior.

Specifications define proposed behavior, boundaries, contracts, persistence or
compatibility requirements, failure behavior, observability, edge cases, and
acceptance criteria. They do not contain implementation steps or code.

If a feature affects the server and any other DevDigest module, place its
specification in the [cross-module SDD directory](../../../docs/specs/README.md).

Use `YYYY-MM-DD-<kebab-feature-name>.md` file names and the corresponding
`SPEC-YYYY-MM-DD-<kebab-feature-name>` identifier.
