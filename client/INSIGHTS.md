# Engineering Insights — Client

This is an append-only log of non-obvious, reusable frontend knowledge. Read it before changing `client/` and re-read it before finishing.

Do not rewrite, reorder, or delete existing entries. Use the project `engineering-insights` skill and its append helper. If an entry becomes outdated, append a new entry that names the earlier insight it supersedes.

Each entry contains a stable ID, date, category, evidence, implication, and concise insight. Routine task history and README summaries do not belong here.

## Insights

<!-- insight-id: eng-client-4e4f020e73b9 -->
## eng-client-4e4f020e73b9 — Unavailable latest-review cost must remain unavailable in the UI

- Date: 2026-10-01
- Category: invariant
- Evidence: client/src/components/run-cost-badge/RunCostBadge.tsx renders nullish cost as an em dash; server/test/reviews.it.test.ts covers a newer failed terminal run with costUsd null; client RunCostBadge tests cover the null rendering.
- Implication: Render the API's nullable cost directly across PR list, timeline, and trace; never substitute zero or retain an older visible cost for a newer unknown value.

A missing cost communicates unknown provider billing, not a free run. The shared cost component preserves this distinction with an em dash while a numeric zero is displayed as /bin/zsh.00.

<!-- insight-id: eng-client-da842d9d1e10 -->
## eng-client-da842d9d1e10 — Unavailable latest-review cost must remain unavailable in the UI

- Date: 2026-10-01
- Category: invariant
- Evidence: Supersedes eng-client-4e4f020e73b9. client/src/components/run-cost-badge/RunCostBadge.tsx renders nullish cost as an em dash; server/test/reviews.it.test.ts covers a newer failed terminal run with costUsd null; client RunCostBadge tests cover the null rendering.
- Implication: Render the API's nullable cost directly across PR list, timeline, and trace; never substitute zero or retain an older visible cost for a newer unknown value.

A missing cost communicates unknown provider billing, not a free run. The shared cost component preserves this distinction with an em dash; a numeric zero remains a numeric USD zero.
