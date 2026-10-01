# Baseline Without `engineering-insights`

Evaluated before the skill existed on 2026-09-18. Evaluators were instructed not to modify files.

## Scenario 1: initial read under time pressure

Observed response:

> "I would not treat `server/INSIGHTS.md` as an instruction source or update it."

The agent performed sensible code tracing and verification, but explicitly skipped both the initial read and final insight check. The skill and root instructions must make module insight discovery part of the development workflow rather than optional documentation work.

## Scenario 2: an insight already exists

Observed response:

> "I’d replace the existing sentence with:"

The agent read the file and recognized that a second entry would duplicate the existing lesson, but proposed rewriting the existing entry to add paths. The skill must forbid replacement and require append-only history; refinements must be new entries that reference what they supersede.

## Scenario 3: trivial work

Observed response:

> "I would not create or append to `client/INSIGHTS.md`."

This is the desired behavior. The skill must preserve the no-op path and must not turn `INSIGHTS.md` into an activity log.
