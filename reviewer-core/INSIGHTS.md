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

<!-- insight-id: eng-reviewer-core-437c16855848 -->
## eng-reviewer-core-437c16855848 — Prompt budgets must measure canonical Brief serialization

- Date: 2026-10-24
- Category: invariant
- Evidence: reviewer-core/src/brief.ts exports assembleBriefPrompt and generateBrief uses it; server/src/modules/brief/application/generate-brief.ts applies its 8,000-token gate to the exported user serialization.
- Implication: Keep every Brief prompt-format change inside assembleBriefPrompt so server-side admission accounting cannot drift from the request sent to a provider.

A content-only estimate misses headings, delimiters, statuses, and paths. The canonical serialized user message is the budget boundary.

<!-- insight-id: eng-reviewer-core-34d6e50003bb -->
## eng-reviewer-core-34d6e50003bb — Brief budgets must include trusted system framing

- Date: 2026-10-24
- Category: invariant
- Evidence: Supersedes eng-reviewer-core-437c16855848. reviewer-core/src/brief.ts estimateBriefPromptTokens measures system and user message framing; server/src/modules/brief/application/generate-brief.ts uses it before the provider call and for persisted telemetry.
- Implication: Any injection-guard or trusted-instruction change must remain inside the canonical full-message estimator, because user-only accounting can exceed the configured provider-input cap.

The untrusted user serialization is necessary but insufficient for a model-input limit. Brief admission and telemetry now share a system-plus-user estimator.
