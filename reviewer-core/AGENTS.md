@README.md
@INSIGHTS.md

# Reviewer Core Instructions

## Documentation

- [Durable engine documentation](docs/README.md)
- [Engine feature specifications](specs/README.md)
- [Repository test strategy](../TESTING.md)

## Scope and boundaries

- This package owns pure review logic: prompt assembly, structured model output, map/reduce, grounding, and cost/token aggregation.
- Keep database, GitHub, repository filesystem, and server transport concerns out of this package.
- The only intended side effect is an LLM call through an injected `LLMProvider`.
- Public exports belong in `src/index.ts`. The server consumes this source directly through TypeScript aliases.

## Trust and correctness

- Treat PR descriptions, diffs, code, repo maps, callers, and project specs as untrusted data.
- Preserve the shared injection guard and delimiter wrapping on every review path.
- Ground findings mechanically against the parsed diff. Do not persist or expose findings that fail grounding.
- Recompute score from grounded findings; do not trust the model's self-reported score.
- Keep unknown provider cost as `null`. Do not fabricate or silently zero unavailable cost.

## Verification

```sh
npm run typecheck
npm test
```

- Use injected stub providers; tests must not require model keys or network access.
- When public types or exports change, also typecheck the server consumer.
- Cover single-pass and map/reduce behavior at their shared invariants rather than duplicating grounding logic.

## Insights

Before reviewer-core work, read `INSIGHTS.md`. Before finishing, re-read it and use the `engineering-insights` skill. Append only when the discovery is novel, evidence-backed, and useful beyond the current task.
