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

<!-- insight-id: eng-client-f7010582f4c0 -->
## eng-client-f7010582f4c0 — Choose USD display precision after rounding at the dollar boundary

- Date: 2026-10-01
- Category: invariant
- Evidence: client/src/components/run-cost-badge/RunCostBadge.tsx rounds sub-dollar values to four decimal places before choosing the dollar format; RunCostBadge.test.tsx covers 0.99999 rendering as $1.00.
- Implication: When a display threshold depends on rounded currency, branch on the rounded value; trimming only fractional zeroes can leave an invalid trailing decimal point.

A value below one before rounding can become exactly one in the displayed precision. Formatting must promote it to the two-decimal dollar representation rather than produce a dangling decimal separator.

<!-- insight-id: eng-client-14f92ab8e339 -->
## eng-client-14f92ab8e339 — Findings previews must mirror the list aggregation rule

- Date: 2026-10-02
- Category: invariant
- Evidence: client/src/app/repos/[repoId]/pulls/helpers.ts uses latestFindingsPerAgent for PRRow hover previews, while PRRow.test.tsx verifies the preview and server/test/reviews.it.test.ts verifies API counts.
- Implication: Keep the hover preview filtered to one latest review per agent whenever list chips are changed; otherwise counts and preview can disagree after a reviewer reruns.

The PR list receives per-agent-current severity counts, whereas the preview fetches review history. Applying the same newest-review-per-agent rule in the client makes both views describe the same findings set.
