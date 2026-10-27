# Dependencies checker fair-eval repair

## Goal

Make the baseline-versus-skill comparison measure dependency-analysis quality,
not runner path errors, unavailable runtimes, or undocumented output formats.

## Arms and shared contract

Both arms receive the same fixture, model configuration, sandbox policy,
network prohibition, and public output contract. The contract requires JSON and
Markdown reports at `result/dependency-report.{json,md}` and names the report
sections and stable JSON fields, without disclosing expected fixture findings.

The baseline has no discoverable project skill. The candidate receives the
same fixture plus a private snapshot under `.codex/skills/dependencies-checker`
and an explicit `$dependencies-checker` request. The source skill remains in
`.claude/skills/dependencies-checker`; the `.codex` location exists only in the
candidate's isolated eval workspace because it is the Codex discovery path.

## Runtime and fixture setup

The bundled launcher selects an already-installed Node.js 16+ runtime; it never
downloads or installs one. Both arms receive the same shell environment.

Every fixture copy is initialized as a minimal Git repository before the model
starts. This makes incidental read-only Git checks deterministic without adding
fixture hints or changing its dependency facts.

## Runner lifecycle and result validity

The runner waits for normal Codex process completion, with an explicit bounded
timeout. It does not terminate a run merely because JSONL includes
`turn.completed`. It reads reports from `repo/result/`, retains trace, stderr,
and any available artifacts, and records an infrastructure failure separately
when report capture, process completion, or timeout fails.

Only runs with a captured, parseable report participate in pass-rate, token,
and duration aggregates. The benchmark reports `valid_runs` and
`infra_failures`; it must never present an all-infrastructure failure as a 0%
skill score.

## Grading

The deterministic oracle checks semantic fixture facts: dependency kinds,
unavailable installed-size state, alias edge, import cycle, duplicate resolved
versions, and P0 cycle prioritization. It does not require baseline prose or
internal ordering to match candidate output. The optional LLM Judge remains a
separate, read-only Markdown-quality check.

## Acceptance criteria

1. One fixture run per arm writes and captures both report files.
2. A missing report is labeled infrastructure failure, not a failed grade.
3. The baseline can satisfy the public report contract without accessing skill
   files.
4. The candidate launcher succeeds when the default `node` is older than 16
   but a compatible local runtime exists.
5. Five completed runs per arm produce a benchmark with distinct valid-run and
   infrastructure-failure counts.
