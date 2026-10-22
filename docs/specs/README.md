# Cross-module SDD Specifications

This directory contains Spec-Driven Development (SDD) specifications that affect
two or more DevDigest modules: `client`, `server`, `reviewer-core`, or `e2e`.

For a change owned by one module, write the specification in that module's
`docs/specs/` directory instead. Keep a specification as close to the module it
governs as its scope allows.

## What belongs here

An SDD specification defines the **what** and **why** of a proposed feature:
the problem, goals and non-goals, user stories, EARS acceptance criteria, edge
cases, measurable non-functional requirements, module interactions, contract
shapes, untrusted-input boundaries, and open questions. A spec may include a
Mermaid workflow or service-communication diagram when it clarifies an
interaction. It does not prescribe implementation files, code, or task
ordering.

The `spec-creator` agent authors these documents. The
`implementation-planner` turns approved requirements into an implementation
plan under [`../superpowers/plans/`](../superpowers/plans/); the plan owns the
**how**.

Record the request, design sources, and repository evidence that support the
specification. If a design URL is private or inaccessible, obtain screenshots
or a textual description rather than treating the URL as evidence. Design and
UX recommendations should state their priority, status, and user impact.

## Conventions

- File name: `YYYY-MM-DD-<kebab-feature-name>.md` (date plus concise feature
  name; no global counter)
- Spec ID: `SPEC-YYYY-MM-DD-<kebab-feature-name>`
- Status lifecycle: `draft` → `approved` → `implemented`
- Language: English

Link a replacement specification through its `Supersedes:` header.
