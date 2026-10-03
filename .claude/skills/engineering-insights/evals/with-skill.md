# Evaluation With `engineering-insights`

Evaluated on 2026-09-18 after the skill, module instructions, rubric, and append helper were available. Evaluators were instructed not to modify files.

## Scenario 1: initial read under time pressure

Observed behavior:

- Classified the request as cross-module before diagnosis.
- Read `server/AGENTS.md`, `server/README.md`, `server/INSIGHTS.md`, and the corresponding `reviewer-core` files before proposing work.
- Required a final re-read and chose a single server boundary insight instead of duplicating module knowledge.

Result: pass. Time pressure no longer caused the insight workflow to be skipped.

## Scenario 2: an insight already exists

Observed response:

> "Do not replace the existing entry."

The evaluator compared meaning rather than wording, rejected the extra paths as non-novel detail, and skipped the write. It also identified the append-only supersession path for a genuinely behavior-changing correction.

Result: pass. The existing file would remain byte-for-byte unchanged.

## Scenario 3: trivial work

Observed response:

> "Reject it because the rubric explicitly excludes a routine success such as changing copy and seeing its focused test pass."

The evaluator re-read `client/INSIGHTS.md`, made no helper call, and reported the no-op.

Result: pass. The skill preserves an empty outcome instead of creating activity-log noise.
