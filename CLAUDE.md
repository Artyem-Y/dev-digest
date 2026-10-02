# DevDigest Instructions

DevDigest is a local-first AI pull-request review system made of four independent packages. Read the [project README](README.md) for the product flow and architecture, and [TESTING.md](TESTING.md) for the test matrix. Do not duplicate those documents here.

## Package routing

| Package | Owns | Local instructions |
|---|---|---|
| `client/` | Next.js studio and browser state | [`client/CLAUDE.md`](client/CLAUDE.md) |
| `server/` | Fastify API, Postgres, repo indexing, background runs | [`server/CLAUDE.md`](server/CLAUDE.md) |
| `reviewer-core/` | Prompt, model call, reduction, and grounding engine | [`reviewer-core/CLAUDE.md`](reviewer-core/CLAUDE.md) |
| `e2e/` | Deterministic browser flows | [`e2e/CLAUDE.md`](e2e/CLAUDE.md) |

These packages have separate manifests and lockfiles. Do not assume a root workspace command is canonical unless the current task explicitly establishes one.

## Start-of-task context

1. Determine every package affected by the request.
2. Before editing a package, read its `CLAUDE.md`, `README.md`, and `INSIGHTS.md`.
3. Read that package's `docs/README.md` and `specs/README.md`, then open only the documents relevant to the task.
4. For cross-package work, repeat this for every affected package. A primary package does not replace another package's local instructions.

## Engineering Insights

Use the project `engineering-insights` skill for development, debugging, review, testing, or architectural work in any package.

- Before work, read the affected package insight logs.
- During work, retain only evidence-backed candidates that are non-obvious and reusable.
- Before the final response, re-read each affected log and check for semantic duplicates.
- If nothing substantial was learned, do not add an entry.
- Never rewrite, reorder, or delete existing insight content. Append through the skill's helper only.

## Cross-package invariants

- `@devdigest/shared` is vendored in both `server/src/vendor/shared` and `client/src/vendor/shared`. A public contract change must update and verify both copies.
- `server` consumes `reviewer-core` source through TypeScript path aliases; review-engine API changes require server typechecking.
- Keep external systems behind the existing adapters and the server DI container. Tests should inject mocks rather than call GitHub, git, or an LLM.
- Keep secrets out of source, logs, fixtures, specs, and insights. The server secrets provider is the only runtime chokepoint.

## Database migrations

Treat committed SQL migrations and `server/src/db/migrations/meta/` as immutable history.

- Never edit, delete, rename, reorder, or repurpose an existing migration.
- Change the current Drizzle schema and generate a new migration.
- Verify both upgrading an existing database and building a clean database from the full migration chain when persistence changes.
- Do not repair migration drift by changing an already-applied file.

## Documentation ownership

- `README.md` describes current behavior and standard commands.
- `docs/` contains durable implementation and operational guidance.
- `specs/` contains proposed or accepted feature contracts and acceptance criteria.
- `INSIGHTS.md` contains append-only, reusable discoveries; it is not a changelog or task log.
- `.claude/skills/` contains reusable procedures. Keep `CLAUDE.md` focused on always-relevant facts and constraints.

## Package commands

Run commands from the package they belong to.

```sh
cd client && pnpm typecheck && pnpm test
cd server && pnpm typecheck
cd server && pnpm exec vitest run --exclude '**/*.it.test.ts'
cd reviewer-core && npm run typecheck && npm test
cd e2e && npm run typecheck
```

Server integration tests require Docker. Browser flows require the hermetic runner and `agent-browser`; do not claim they passed without running them.

## Completion

- Run the narrowest test that proves the changed behavior, then the affected package typecheck.
- Run broader suites in proportion to cross-package and persistence risk.
- Inspect the final diff and run `git diff --check`.
- Report exactly what was and was not verified.
- Complete the Engineering Insights check before the final response.
