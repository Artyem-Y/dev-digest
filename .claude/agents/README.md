# DevDigest agent map

This directory holds project-scoped Claude Code agent definitions. Use an agent
for the role it owns; do not treat this README as a replacement for the
agent's own prompt or the repository instructions.

## Workflow

```text
researcher → planner → test-writer → implementer
                         ↓                 ↓
                  focused tests     implementation result
                                           ↓
                    plan-verifier + architecture-reviewer → doc-writer

Security review remains a separate downstream role when the changed boundary
requires it.
```

## Agents

| Agent | Responsibility | Model | Permissions | Input artifacts | Output artifacts |
|---|---|---|---|---|---|
| [researcher](researcher.md) | Answers a precise repository or external-research question with evidence; asks for clarification when the question is not concrete. | `terra` | Read, Grep, Glob, WebSearch, WebFetch; `Write` and `Edit` denied; plan mode. | Concrete question, scope or decision to inform, optional recency requirement. | `Repository Research Report` or `External Research Report`, each with evidence and `Not found`. |
| [planner](planner.md) | Converts researched context and product intent into an evidence-backed Development Plan. It identifies affected modules, constraints, required implementation skills, tests, risks, and handoff scope. | `terra` | Read, Grep, Glob; `Write` and `Edit` denied; plan mode. | Concrete change request, research report when needed, applicable package context. | `Development Plan` with acceptance criteria, ordered steps, exact files/symbols, verification commands, assumptions, and review handoff. |
| [test-writer](test-writer.md) | Writes focused UI and backend regression tests for an approved behavior change without modifying production behavior. | `inherit` | Read, Grep, Glob, Bash, Write, Edit; prompt-limited to tests, fixtures, and test-local helpers. | Approved plan, expected behavior, permitted test scope. | `Test Design and Result` with coverage matrix and fresh command evidence. |
| [implementer](implementer.md) | Implements an approved plan in the affected frontend/backend packages, applies relevant local skills, and verifies its direct changes. | `inherit` | Read, Grep, Glob, Bash, Write, Edit. | Approved Development Plan and relevant package context. | `Implementation Result`: completed plan steps, changed files, applied skills, fresh verification evidence, limitations, and handoff to reviewers. |
| [plan-verifier](plan-verifier.md) | Traces every approved plan requirement to completed code and fresh test/command evidence. | `terra` | Read, Grep, Glob; `Write` and `Edit` denied; plan mode. | Plan, implementation result, diff, changed-file list, fresh verification output. | `Plan Verification Report` with requirement-level statuses and gaps. |
| [architecture-reviewer](architecture-reviewer.md) | Reviews a completed change for package and dependency boundaries using evidence-backed findings. | `terra` | Read, Grep, Glob; `Write` and `Edit` denied; plan mode. | Plan, implementation result, diff, changed-file list. | `Architecture Review Report` with severity, `file:line` evidence, remediation, and unreviewed scope. |
| [doc-writer](doc-writer.md) | Documents verified completed functionality in the correct README, docs, specs, or insights destination. | `inherit` | Read, Grep, Glob, Bash, Write, Edit; prompt-limited to documentation artifacts. | Plan, implementation result, changed-file list, fresh verification evidence. | `Documentation Result` with source evidence, destination rationale, and link/rendering checks. |

## Boundaries

- `researcher` is read-only and never invokes `/deep-research`.
- `planner` plans but does not mutate the repository.
- `implementer` does not substitute self-verification for architecture or
  security review; those are explicit downstream roles.
- `test-writer` does not change production behavior; implementation defects go
  back to `implementer` with test evidence.
- `plan-verifier` verifies completed code against each plan requirement rather
  than offering general advice.
- `architecture-reviewer` reports only evidence-backed architecture findings;
  it is not a security reviewer.
- `doc-writer` documents verified behavior and does not make documentation a
  substitute for the implementation source of truth.
- All agents preserve unrelated worktree changes and must not read or expose
  `.env` files.

## Efficient handoffs

The suite uses [the handoff protocol](handoff-protocol.md) to avoid repeating
plans, diffs, and successful command transcripts. It defines the shared Context
Manifest, Research Bundle, Task Card, Verification Matrix, and Review Packet,
plus dispatch and model-routing rules. These compact artifacts do not replace
required package instructions, Engineering Insights reads, or evidence-backed
review.

## Planner rule sources

| Rule group | Source |
|---|---|
| Project-scoped agent files, YAML frontmatter, tool restrictions, plan mode, and skill preloading | [Claude Code — Create custom subagents](https://code.claude.com/docs/en/sub-agents) |
| Required DevDigest package discovery, documentation/insight reading, contract and migration boundaries | [Repository instructions](../../AGENTS.md) and [Engineering Insights skill](../skills/engineering-insights/SKILL.md) |
| Skill selection by task trigger | The relevant local `SKILL.md` under [`../skills/`](../skills/) |

## Implementer rule sources

| Rule group | Source |
|---|---|
| Skills as scoped, reusable procedures and their loading behavior | [Claude Code — Extend Claude with skills](https://code.claude.com/docs/en/skills) and [Agent Skills specification](https://agentskills.io/specification) |
| Package ownership, tests, contract copies, DI boundaries, and immutable migrations | [Repository instructions](../../AGENTS.md), then the affected package's `AGENTS.md` |
| Insight lifecycle | [Engineering Insights skill](../skills/engineering-insights/SKILL.md) |
| Frontend, backend, persistence, contract, and test practices | The selected local `SKILL.md` files under [`../skills/`](../skills/) |

## Specialist-agent rule sources

| Rule group | Source |
|---|---|
| Test evidence, plan/implementation separation, and independent verification | [Claude Code — Best practices](https://code.claude.com/docs/en/best-practices) |
| Read-only review permissions, evidence-backed findings, and severity | [Claude Code — Create custom subagents](https://code.claude.com/docs/en/sub-agents) and [Claude Code — Code Review](https://code.claude.com/docs/en/code-review) |
| Skills as reusable local procedures | [Claude Code — Extend Claude with skills](https://code.claude.com/docs/en/skills) and [Agent Skills specification](https://agentskills.io/specification) |
| Diagram accessibility and explanatory scope | [GitHub Docs — Creating diagrams](https://docs.github.com/en/contributing/writing-for-github-docs/creating-diagrams-for-github-docs) and local [`mermaid-diagram`](../skills/mermaid-diagram/SKILL.md) skill |

Sources explain the rules' origin; the approved Development Plan selects the
smallest applicable skill set for a concrete implementation.
