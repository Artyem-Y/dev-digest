@README.md
@INSIGHTS.md

# Client Instructions

## Documentation

- [Durable frontend documentation](docs/README.md)
- [Frontend feature specifications](specs/README.md)
- [Repository test strategy](../TESTING.md)

## Scope and boundaries

- This package owns the Next.js App Router UI, React components, client state, localization, and HTTP/SSE consumption.
- Keep pages thin. Put feature UI in colocated `_components/` directories and reusable behavior in `src/lib/` or shared components.
- Use `src/lib/api.ts` as the HTTP boundary and TanStack Query hooks in `src/lib/hooks/` for server state.
- Do not duplicate server business logic in the client. Render the API contract and handle loading, empty, error, and live-running states explicitly.
- UI primitives and charts under `src/vendor/ui` are shared local infrastructure; prefer them over one-off replacements.

## Contracts and copy

- Imports from `@devdigest/shared` resolve to `src/vendor/shared`. Coordinate contract changes with `server/src/vendor/shared` and verify both packages.
- Put user-facing copy in `messages/en/*.json` and access it through `next-intl`.
- Preserve nullable API states. Display a deliberate fallback for unavailable values instead of inventing data.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
```

- Use React Testing Library and Vitest for component behavior; mock `fetch` rather than requiring the API.
- Run `pnpm build` for routing, server/client boundary, or Next.js configuration changes.
- Browser journeys belong in `../e2e/`, not in the client unit suite.

## Insights

Before client work, read `INSIGHTS.md`. Before finishing, re-read it and use the `engineering-insights` skill. Append only when the discovery is novel, evidence-backed, and useful beyond the current task.
