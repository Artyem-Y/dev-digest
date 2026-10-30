# Engineering Insights — E2E

This is an append-only log of non-obvious, reusable browser-test knowledge. Read it before changing `e2e/` and re-read it before finishing.

Do not rewrite, reorder, or delete existing entries. Use the project `engineering-insights` skill and its append helper. If an entry becomes outdated, append a new entry that names the earlier insight it supersedes.

Each entry contains a stable ID, date, category, evidence, implication, and concise insight. Routine task history and README summaries do not belong here.

## Insights

<!-- insight-id: eng-e2e-37843345a6b7 -->
## eng-e2e-37843345a6b7 — Isolate Next build output for the hermetic browser stack

- Date: 2026-10-29
- Category: testing
- Evidence: Concurrent next dev processes on ports 3000 and 3200 shared client/.next and produced missing vendor chunk errors; client/next.config.mjs now uses .next-e2e for the hermetic runner.
- Implication: Keep hermetic Next build output separate from the developer server when running both stacks concurrently.

Separate ports and databases do not isolate Next build artifacts. Two dev servers writing the same output directory can corrupt each other and yield misleading 500 responses.

<!-- insight-id: eng-e2e-ac36b82ef62b -->
## eng-e2e-ac36b82ef62b — Scroll nested main before clicking offscreen controls

- Date: 2026-10-29
- Category: testing
- Evidence: The onboarding browser flow reported a successful Share link click after scrolling main, but a capture listener observed the click on HTML; explicit scrollintoview on the button delivered the event to Share link and the rerun passed.
- Implication: Before clicking an offscreen control inside AppFrame main, scroll the target into view and assert the resulting action rather than trusting the click command exit.

Agent-browser can report a successful coordinate click even when the target in the nested scrolling main remains outside the viewport and HTML receives the event.
