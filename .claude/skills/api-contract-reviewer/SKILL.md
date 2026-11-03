---
name: api-contract-reviewer
description: Review public HTTP API changes for breaking contracts, schema compatibility, semver, and deprecation.
---

# API Contract Reviewer

Apply all four rules in this directory to changed public routes, request/response DTOs, OpenAPI documents, and client-visible error payloads. Report an issue only when a changed diff line proves it.

Read: [breaking-change](breaking-change.md), [response-schema](response-schema.md), [semver-discipline](semver-discipline.md), [deprecation-policy](deprecation-policy.md).

## Reporting

Tie every finding to a changed line and identify the affected contract and compatibility impact.
