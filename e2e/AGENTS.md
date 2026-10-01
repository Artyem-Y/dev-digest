@README.md
@INSIGHTS.md

# E2E Instructions

## Documentation

- [Durable browser-test documentation](docs/README.md)
- [Executable flow specifications and index](specs/README.md)
- [Repository test strategy](../TESTING.md)

## Scope and boundaries

- This package owns deterministic `agent-browser` journeys across the real client, server, and seeded PostgreSQL stack.
- Keep executable flows in `specs/NN-name.flow.json`; `run.ts` executes them in lexical order in one shared browser session.
- Use deterministic URL, text, label, or role locators. Never use `agent-browser chat` or an LLM.
- Flows should use read-only seeded data unless a specification explicitly defines isolated mutation and cleanup.
- Failure screenshots belong in `test-results/`, which remains generated and git-ignored.

## Environment safety

- Prefer `../scripts/e2e.sh`; it creates an isolated stack on alternate ports and leaves the development database untouched.
- Never use `docker compose down -v` to repair an e2e failure against the development stack.
- Preserve the seeded-repository assumptions documented in the README when adding or reordering flows.

## Verification

```sh
npm run typecheck
npm test
```

- `npm test` against a developer stack is valid only when its database satisfies the documented seed precondition.
- Use `npm run e2e:hermetic` for reliable full-flow evidence.
- Report prerequisites or skipped browser verification explicitly.

## Insights

Before e2e work, read `INSIGHTS.md`. Before finishing, re-read it and use the `engineering-insights` skill. Append only when the discovery is novel, evidence-backed, and useful beyond the current task.
