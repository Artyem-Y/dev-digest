# DevDigest agent map

This directory holds project-scoped Claude Code agent definitions. Use an agent
for the role it owns; do not treat this README as a replacement for the
agent's own prompt or the repository instructions.

## Workflow

```text
researcher → brainstorm → spec-creator → approval → implementation-planner
                                                        ↓
                                             plan-verifier (preflight)
                                                        ↓
                              optional test design → parallel implementers
                                                        ↓
                                      integration gate + pr-self-review
                                                        ↓
                                          plan-verifier (completion)
                                                        ↓
                        architecture-reviewer + security-reviewer (when triggered)
                                                        ↓
                                   focused remediation → re-verification → doc-writer
```

## Agents

| Agent | Responsibility | Model | Permissions | Input artifacts | Output artifacts |
|---|---|---|---|---|---|
| [researcher](researcher.md) | Answers a precise repository or external-research question with evidence; asks for clarification when the question is not concrete. | `terra` | Read, Grep, Glob, WebSearch, WebFetch; `Write` and `Edit` denied; plan mode. | Concrete question, scope or decision to inform, optional recency requirement. | `Repository Research Report` or `External Research Report`, each with evidence and `Not found`. |
| [brainstorm](brainstorm.md) | Explores a bounded request before planning and recommends one evidence-grounded direction. | `terra` | Read, Grep, Glob; `Write` and `Edit` denied; plan mode. | Concrete request, constraints, and relevant repository context. | `Brainstorm Result` with options, trade-offs, recommendation, open decisions, and `Not found`. |
| [spec-creator](spec-creator.md) | Turns an agreed request and user-provided design sources into a draft SDD specification. It analyses gaps, corner cases, module interactions, and UX improvements before implementation planning. | `terra` | Read/search/fetch plus Markdown Write/Edit only for non-README SDD specs under `docs/specs/`; all other files are read-only. | Concrete request; user-provided text, Figma/design sources, screenshots, existing code, or repository context. | Draft specification defining WHAT/WHY, EARS acceptance criteria, design review, contracts, and open questions. |
| [implementation-planner](implementation-planner.md) | Verifies agreed requirements and creates the HOW-only Implementation Plan. It asks clarifying questions, gives recommendations, and requires an execution-mode choice before writing. | `terra` | Read, Grep, Glob, Write, Edit, AskUserQuestion; writes only plans in `docs/plans/`. | Approved specification, ticket, or clear requirements plus applicable package context. | Implementation Plan with verified requirements, selected execution mode, exact paths/symbols, dependencies, verification commands, and handoff scope. |
| [test-writer](test-writer.md) | Creates a test-design matrix or writes focused regression tests without modifying production behavior. | `inherit` | Read, Grep, Glob, Bash, Write, Edit; prompt-limited to tests, fixtures, and test-local helpers. | Approved plan, expected behavior, assigned mode, permitted test scope. | `Test Design and Result` with coverage matrix and focused command evidence. |
| [implementer](implementer.md) | Implements an approved plan task using planner-selected skills and either focused or integration-owned verification. | `inherit` | Read, Grep, Glob, Bash, Write, Edit. | Approved Development Plan, task card, and relevant package context. | `Implementation Result`: completed plan steps, changed files, applied skills, fresh verification receipts, limitations, and handoff to reviewers. |
| [plan-verifier](plan-verifier.md) | Preflights plan traceability before code or traces every requirement to completed code and fresh evidence afterwards. | `sonnet` | Read, Grep, Glob; `Write` and `Edit` denied; plan mode. | Preflight: approved spec/waiver and plan. Completion: plan, implementation result, diff, changed-file list, fresh verification output. | `Plan Preflight Report` or `Plan Verification Report` with requirement-level gaps/statuses. |
| [architecture-reviewer](architecture-reviewer.md) | Independently reviews a completed, completion-verified change for package and dependency boundaries. | `sonnet` | Read, Grep, Glob; `Write` and `Edit` denied; plan mode. | Plan, completion verification, implementation result, diff, changed-file list. | `Architecture Review Report` with severity, `file:line` evidence, remediation, and unreviewed scope. |
| [security-reviewer](security-reviewer.md) | Independently reviews a completed, completion-verified change for concrete vulnerabilities and unsafe trust flows. | `terra` | Read, Grep, Glob; `Write` and `Edit` denied; plan mode. | Plan, completion verification, implementation result, diff, changed-file list. | `Security Review Report` with attack-path evidence, remediation, and unreviewed scope. |
| [doc-writer](doc-writer.md) | Documents verified completed functionality in the correct README, docs, specs, or insights destination. | `inherit` | Read, Grep, Glob, Bash, Write, Edit; prompt-limited to documentation artifacts. | Plan, implementation result, changed-file list, fresh verification evidence. | `Documentation Result` with source evidence, destination rationale, and link/rendering checks. |

## Plan execution command

Use [`/run-plan`](../skills/run-plan/SKILL.md) only after the specification and
Implementation Plan have been manually approved. It runs `plan-verifier`
preflight, dispatches `implementer` tasks by the plan DAG, skips `test-writer`
to save a dedicated agent pass, runs the integration gate and completion
verification, then resolves actionable reviewer findings in a bounded loop. It
never authors a specification/plan or pushes, merges, or opens a pull request.

## Boundaries

- `researcher` is read-only and never invokes `/deep-research`.
- `brainstorm` narrows options before planning; it neither approves scope nor edits files.
- `spec-creator` writes only draft/revised SDD specifications in the allowed `docs/specs/` locations; it never writes implementation plans or product files.
- `implementation-planner` writes only implementation plans. It never authors or edits specifications, product code, tests, contracts, or configuration.
- `implementer` does not substitute self-verification for architecture or
  security review; those are explicit downstream roles.
- `pr-self-review` is a local integration-owner checklist. It catches obvious
  final-diff omissions before handoff; it is not an independent review and
  cannot replace `plan-verifier`, `architecture-reviewer`, or
  `security-reviewer`.
- `test-writer` does not change production behavior; implementation defects go
  back to `implementer` with test evidence.
- `plan-verifier` (`sonnet`) runs a preflight before code is dispatched and verifies
  completed code against each plan requirement afterwards; it does not offer
  general advice in either mode.
- `architecture-reviewer` (`sonnet`) reports only evidence-backed architecture findings;
  it is not a security reviewer.
- `security-reviewer` independently reviews security paths and does not replace
  architecture review.
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

## Spec Creator and Implementation Planner rule sources

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
