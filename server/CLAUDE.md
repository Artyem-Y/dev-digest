@README.md
@INSIGHTS.md

# Server Instructions

## Documentation

- [Durable backend documentation](docs/README.md)
- [Backend feature specifications](specs/README.md)
- [Repository test strategy](../TESTING.md)

## Scope and boundaries

- This package owns the Fastify API, PostgreSQL persistence, background jobs, repository indexing, SSE transport, and external-system adapters.
- Keep transport in `src/modules/<name>/routes.ts`, orchestration in services, persistence in repositories, and external I/O behind adapters.
- Resolve dependencies through `src/platform/container.ts`; tests should use container overrides and mocks.
- Obtain workspace and user scope through `modules/_shared/context.ts`. Do not bypass scoping in repositories or handlers.
- Define request and response shapes with the shared Zod contracts and the Fastify Zod type provider.

## Persistence and migrations

- The current Drizzle schema is the source for new schema changes.
- Never modify existing files in `src/db/migrations/` or `src/db/migrations/meta/`. Generate a new migration.
- Migrations do not run on server boot. Testcontainers and local setup call `runMigrations` explicitly.
- Preserve nullable values when an upstream provider cannot supply data; do not substitute a guessed value.

## Security and operations

- Do not read, print, persist, or place secrets in insights. Use `SecretsProvider`; environment variables are fallback inputs, not documentation values.
- Keep expensive routes rate-limited and long-lived SSE routes exempt from request-rate limits.
- The in-memory run bus assumes one API process per database; do not claim multi-replica safety without adding ownership or coordination.

## Verification

```sh
pnpm typecheck
pnpm exec vitest run --exclude '**/*.it.test.ts'
pnpm exec vitest run .it.test
```

- Name database-backed tests `*.it.test.ts`; they require Docker and real PostgreSQL.
- Use `app.inject()` for route tests and mocks for GitHub, git, and LLM providers unless the behavior specifically belongs to an integration test.
- Persistence changes require migration-chain verification against a clean database.

## Insights

Before server work, read `INSIGHTS.md`. Before finishing, re-read it and use the `engineering-insights` skill. Append only when the discovery is novel, evidence-backed, and useful beyond the current task.
