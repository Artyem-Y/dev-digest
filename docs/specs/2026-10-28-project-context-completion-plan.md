# Project Context Completion Implementation Plan

**Goal:** Complete the Project Context journey defined in [the approved specification](2026-10-23-project-context.md), from document selection to an auditable review prompt.

**Architecture:** Keep tracked-document access and workspace-scoped attachments behind the existing Project Context adapters. Resolve the selected agent's direct attachments and enabled skill attachments at run time, pass their current contents through reviewer-core's untrusted spec boundary, and persist the resulting prompt snapshot and paths in the run trace. Reuse a repository-scoped document selector in the agent and skill editors and expose a read-only document browser in the shell.

**Tech stack:** Fastify, Drizzle/Postgres, Next.js, React, TanStack Query, reviewer-core, Vitest, and deterministic browser flows.

## Work

- [ ] Add persistent ordering for owner attachments with a new migration, scoped reorder operation, and tests for ordering, authorization, and missing documents. Preserve existing attachments and use the canonical token estimator.
- [ ] Resolve only the selected agent's documents and enabled linked skills, deduplicate them in stable order, skip unavailable documents safely, and inject their text into the review pipeline. Persist actual paths and the exact untrusted prompt snapshot; cover injection, inheritance, isolation, missing files, and snapshots.
- [ ] Add a read-only Project Context catalog page and navigation, with search, preview, loading, empty, and failure states.
- [ ] Add Context tabs for agents and skills with attachment counts, search, previews, token totals, unavailable-document recovery, and persisted drag/keyboard ordering. Show skill usage and attachment provenance where available.
- [ ] Verify run details show Specs read and Project context in Prompt assembly, including skipped documents, and add focused UI coverage.
- [ ] Extend deterministic browser coverage for selecting a document and observing it in a completed review trace; document the demonstration steps without claiming a video was recorded.
- [ ] Run targeted tests, affected package typechecks, appropriate database migration checks and browser journey, inspect the diff, and complete Engineering Insights review.

## Demonstration to record after verification

1. Open Project Context from the sidebar and preview a tracked Markdown document.
2. Open an agent's Context tab, attach the document, show the count, estimate, and reorder controls; then show a skill's Context tab and its attachment.
3. Run that agent on a test PR, open the completed run's trace, and show the document path under Specs read and the captured text under Prompt assembly → Project context attached specs.
4. Explain that the document is repository data wrapped as untrusted input, and that the completed trace preserves the text used for that run.
