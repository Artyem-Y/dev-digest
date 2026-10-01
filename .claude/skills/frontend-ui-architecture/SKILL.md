---
name: frontend-ui-architecture
version: 1.0.0
description: Use when deciding where React or Next.js frontend code belongs, splitting UI components, or moving constants, helpers, hooks, and feature logic. Covers code ownership and server-client boundaries, not performance tuning or generic React hook rules.
---

# Frontend UI Architecture

Use this skill for React and Next.js code-organization decisions. Follow the
existing project layout before introducing a new folder or abstraction.

This skill complements, rather than replaces:

- `react-best-practices` for component purity, state, Effects, and Hooks;
- `next-best-practices` for Next.js APIs, RSC behavior, and routing details;
- `react-testing-library` for test design.

Read [README.md](README.md) when a recommendation needs its source or when
updating this skill's rules.

## Start with ownership

Before placing code, identify all of the following:

1. Which route or feature owns the behavior?
2. Is the code UI, server state, a pure transformation, static configuration,
   or a domain rule?
3. Does a second independent consumer already need it?
4. Does the code need browser APIs, interactivity, secrets, or privileged
   server access?

Keep code with its first real owner. Promote it only after a second independent
consumer needs the same stable abstraction. Do not create a shared layer merely
because an item might be reused later.

## DevDigest placement rules

| Code | Place it here | Notes |
|---|---|---|
| Route entry and route composition | `src/app/**/page.tsx`, `layout.tsx`, or Next special files | Keep entries thin: compose UI and pass route data/params onward. |
| UI owned by one route | Adjacent `src/app/**/_components/<Component>/` | Colocate its test, `constants.ts`, `helpers.ts`, `styles.ts`, and private child components. |
| Shared application UI | `src/components/<domain>/` | Use only when two or more independent routes/features own the same semantic component. |
| Existing primitive, chart, shell, or icon | `src/vendor/ui/` | Reuse the local UI infrastructure; do not create a competing primitive for an equivalent need. |
| HTTP transport | `src/lib/api.ts` | This is the API boundary. Components and route files do not call `fetch` directly. |
| Remote server state and mutations | `src/lib/hooks/` | Use the existing TanStack Query hook layer; expose UI-ready query/mutation interfaces. |
| Pure helper used by one owner | That owner's `helpers.ts` | Keep it deterministic and free of React state, I/O, and hidden globals. |
| Pure helper with several independent consumers | A focused module in `src/lib/` | Name it for the domain operation, not as a catch-all `utils` bucket. |
| Stateful UI behavior used by one feature | A colocated `use*.ts` hook | Extract only a coherent reusable behavior, not a component's incidental local state. |
| Stateful behavior used by several features | `src/lib/hooks/` | Keep API calls in the API/hook boundary and make dependencies explicit. |
| Static display options, mappings, or limits | Owner-local `constants.ts` | Promote only when multiple independent consumers use the same meaning. |
| User-visible copy | `messages/en/*.json` | Access it through `next-intl`; do not duplicate product strings as TypeScript constants. |
| Shared API contracts | `src/vendor/shared/` | Coordinate public changes with the matching server vendor copy. |

Nested `_components/` directories are appropriate only for private children of a
feature. A child becomes a sibling component when it has an independent role,
test surface, or ownership boundary.

## Logic boundaries

Components render props and wire interactions. Put deterministic presentation
mapping in local helpers and reusable stateful behavior in a custom Hook.

The frontend may implement view-specific decisions such as formatting, tab
selection, optimistic UI state, and converting an API value into display data.
It must not become the authority for authorization, pricing, persistence
invariants, or other server business rules. Keep those rules in the server or
shared contract, and treat client-side guards as UX rather than access control.

Do not duplicate API transport in a component or invent a second client for one
endpoint. Extend `src/lib/api.ts` and expose server state through the relevant
TanStack Query hook.

## Next.js boundaries

`app/` is a filesystem router, not a general shared-components directory. Keep
route-specific UI under that route's `_components/` and use `src/components/`
for cross-route UI.

Server Components are the default. Add `'use client'` at the smallest component
boundary that needs event handlers, local state, Effects, browser APIs, or a
client-only hook. Keep server-to-client props serializable.

Use Server Components for server-safe composition and data access only when the
application already has an appropriate server-side boundary. DevDigest client
server state otherwise goes through `src/lib/api.ts` and `src/lib/hooks/`; do
not create a parallel browser/server data contract for a one-off route.

Keep `loading.tsx`, `error.tsx`, `not-found.tsx`, and route-level `layout.tsx`
as route concerns. Do not hide their behavior in unrelated shared components.

## Security boundaries

- Anything delivered to a Client Component is observable by users. Never put
  secrets or privileged server logic in client-reachable modules; `NEXT_PUBLIC_`
  values are public.
- Do not import server-only dependencies into a Client Component or a shared
  module that can enter the client bundle.
- API responses, URL parameters, browser storage, and rendered rich content can
  contain attacker-controlled data. React's normal JSX escaping is preferred;
  treat raw HTML rendering and untrusted URLs as explicit security-review
  boundaries.
- A hidden button, route guard, or client-side role check is not authorization.
  Protected server actions remain responsible for authentication and
  authorization.

## Decision checks

Before finalizing an architecture change, answer these questions in the review:

1. Who owns this code today, and is its directory adjacent to that owner?
2. Is a shared abstraction justified by at least two independent consumers?
3. Did any component bypass `src/lib/api.ts` or `src/lib/hooks/`?
4. Did route-only code leak into `src/components/`, or shared UI leak into a
   route without a reason?
5. Is the server/client boundary minimal and free of secrets or privileged
   imports?
6. Are new user-facing strings localized and shared contracts coordinated?
