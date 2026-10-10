# Engineering Insights — Reviewer Core

This is an append-only log of non-obvious, reusable review-engine knowledge. Read it before changing `reviewer-core/` and re-read it before finishing.

Do not rewrite, reorder, or delete existing entries. Use the project `engineering-insights` skill and its append helper. If an entry becomes outdated, append a new entry that names the earlier insight it supersedes.

Each entry contains a stable ID, date, category, evidence, implication, and concise insight. Routine task history and README summaries do not belong here.

## Insights

<!-- insight-id: eng-reviewer-core-3bd5151ce9a9 -->
## eng-reviewer-core-3bd5151ce9a9 — Structured review must preserve an unset temperature

- Date: 2026-10-01
- Category: boundary
- Evidence: reviewer-core/src/llm/openrouter.ts conditionally includes temperature; reviewer-core/test/openrouter.test.ts captures a review request without that field when the caller leaves it undefined.
- Implication: Keep optional tuning parameters absent on OpenRouter-compatible review requests unless a caller explicitly chooses them.

ReviewPullRequest does not select a temperature. The provider adapter must not convert that absence to zero, because some routed models accept only their default sampling configuration.

<!-- insight-id: eng-reviewer-core-8fff2c98bad4 -->
## eng-reviewer-core-8fff2c98bad4 — Prompt observability must derive from sections before rendering

- Date: 2026-10-10
- Category: security
- Evidence: reviewer-core/src/prompt.ts records PromptSectionTelemetry while adding sections; reviewer-core/test/prompt.test.ts proves telemetry excludes injected secret and private specification strings.
- Implication: Add prompt telemetry from structured section metadata, never by serializing or parsing assembled messages, so observability cannot disclose untrusted prompt content.

Rendered prompts mix headers, delimiters, diffs, PR text, and project context. The assembly boundary still knows only section identity, static source, and length, which is sufficient for diagnostics without retaining or logging content.
