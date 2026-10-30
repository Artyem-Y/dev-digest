# Agent evaluation CI

This document describes the repository's executable evaluations for local
skills and agent instructions. It is operational guidance, not an SDD
specification or a development plan.

## Purpose

An eval measures whether an instruction bundle helps an agent complete a
bounded repository task. It must keep the task prompt and fixture identical
between arms, keep expected answers outside the fixture, and preserve the
trace and deterministic grade for later inspection.

The current workflow evaluations exercise three boundaries:

- `client-contract-change` — client transport, contract use, visible states,
  and focused evidence;
- `server-safe-module-change` — thin transport, application boundary,
  request scope, and route-level verification;
- `persistence-and-verification` — new schema migration, immutable migration
  history, integration-test selection, and honest environment-blocked
  evidence.

The persistence fixture does not start PostgreSQL. It evaluates whether the
agent selects the correct persistence test lane and reports an unavailable
database environment honestly. A real migration-chain test belongs in a
separate integration eval with a complete package and PostgreSQL runtime.

## Layout

```text
.claude/skills/devdigest-verification/evals/
  composite-workflows.json       # public task, fixture, and candidate skill set
  public-completion-contract.md  # output format shared by both arms
  fixtures/<workflow>/           # neutral miniature repository
  fixtures/<workflow>/expected.json  # private deterministic oracle
  grade-workflow.mjs             # deterministic grader
  run-workflows.mjs              # isolated baseline/candidate executor

scripts/select-evals.mjs         # maps changed instructions to runnable evals
scripts/validate-eval-assets.mjs # verifies eval assets without a model call
.github/workflows/agent-evals.yml
```

Fixture source and prompts must not name seeded defects or expected findings.
The private `expected.json` is available only to the post-run grader.

## CI selection and skips

The separate `eval static checks` workflow runs on every pull request without
model calls or API credentials. Its `eval-static` job has a stable name suitable
for branch protection. Configure branch protection separately in GitHub.

Live model-backed evals are disabled by default. Set the GitHub Actions
repository variable `LIVE_EVAL_ENABLED` to the exact string `true` to enable
them for eligible PRs and manual dispatches. Other values and an unset variable
skip live jobs; validation and the static checks still run. This is a repository
variable because the job-level condition is evaluated before the job's
environment is available.

The desired limits are $0.25 per model session and $2 per month for the eval
project. Neither limit is enforced by the workflow. Codex CLI has no verified
per-session dollar cap, and timeouts or token counts are not a hard spend cap.
Configure the monthly hard limit in the dedicated OpenAI project's Limits page;
OpenAI notes that enforcement is not instantaneous. Do not enable live evals
expecting a $0.25 session cap until an independently verified spending controller
is in place.

The `agent-evals` GitHub Actions workflow runs on pull requests that change a
skill, agent, instruction file, eval selector, validator, or the workflow
itself. It first validates assets and runs deterministic grader tests.

`scripts/select-evals.mjs` then reads the changed-file set:

- root instructions select all composite workflows;
- `client/AGENTS.md` selects the client workflow;
- `server/AGENTS.md` selects server and persistence workflows;
- changes beneath `devdigest-verification` select all composite workflows;
- a skill with `evals/run-evals.mjs` selects that skill's executable eval.

No eval is inferred merely because an instruction changed. If a changed skill
has no `evals/` directory, an eval directory without a runner, or a changed
agent has no configured agent eval, the selector emits a GitHub Actions notice
with `Eval skipped` and a reason. It does not make a model call for that item.

The live job receives the selection from validation and runs each selected eval
in a separate matrix job, with at most two jobs in parallel and no fail-fast.
Each job summarizes its benchmark and uploads its own artifact even after a
failure. Local artifacts remain ignored by Git.

CI starts the OpenAI Responses API proxy as root and runs the eval harness as a
separate unprivileged user with a clean environment. The API key is provided to
the proxy only; it is not passed to the eval user. The proxy limits the endpoint,
but an eval can still use it to make model requests. The workflow and harness
must themselves be trusted: a same-repository PR can modify workflow steps or
scripts executed before the proxy starts. The fork restriction alone is not an
authorization boundary for untrusted contributors. Apply environment approval
and branch protections as appropriate. The Linux smoke test exercises the
official proxy and Codex against a local mock with a synthetic key and checks
the proxy process boundary. This does not verify the full eval harness, the
GitHub runner configuration, or a real OpenAI API request.

## Evaluation protocol

For each selected workflow, the runner creates isolated baseline and candidate
workspaces. Both receive the same fixture, prompt, sandbox policy, and output
contract. The candidate additionally receives the named skill snapshot and an
explicit skill invocation. The runner captures JSONL traces, stderr, structured
completion output, elapsed time, and deterministic grade.

The grader evaluates required changed paths, required semantic evidence,
immutable files, and verification receipts. An environment block is acceptable
only where the private oracle explicitly permits it. Infrastructure failures are
reported separately from quality failures; they are not converted into a zero
quality score.

## Models and providers

The active CI runners use `codex exec`; their model is configured with
`EVAL_MODEL` (or the workflow-dispatch input) and must be a Codex-supported
model. The workflow does not read, print, or persist secret values.

The intended future routing is Gemini through OpenRouter for composite workflow
evals and a pinned economical DeepSeek model for routine skill/agent evals.
That routing is not active yet: an OpenRouter model ID cannot be passed to
`codex exec` as a substitute. Enabling it requires a dedicated OpenRouter
tool-loop executor with the same sandbox, trace, timeout, and artifact
contracts as the current runner.

## Adding an eval

1. Keep the fixture and prompt neutral; write expected facts only in the
   private oracle.
2. Add a deterministic grader and unit tests before enabling live runs.
3. Provide `evals/run-evals.mjs` when the eval is executable in CI.
4. Run `node scripts/validate-eval-assets.mjs` and the narrow grader tests.
5. Update this document when a new runner, selection rule, provider, or
   artifact contract changes the operational behavior.
