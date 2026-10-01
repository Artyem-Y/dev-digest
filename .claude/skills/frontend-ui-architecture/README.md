# Frontend UI Architecture

Version: 1.0.0

This skill defines code ownership and placement for the DevDigest Next.js
client. It does not replace the existing React, Next.js, or testing skills; it
turns their architectural implications into a project-specific placement guide.

## Scope

The skill answers where route UI, shared components, constants, helpers, hooks,
API transport, server state, translations, and contracts belong. It also records
the architectural security boundaries between Next.js Server Components and
Client Components.

It intentionally excludes performance tuning, React hook mechanics, detailed
Next.js API usage, and test-writing technique. Consult the existing specialised
skills for those topics.

## Source register

Sources were reviewed on 2026-10-01. React and Next.js documentation are the
normative sources; the Vercel material is supplementary and is not used for
performance rules in this skill.

| Source | Used for |
|---|---|
| [React: Keeping Components Pure](https://react.dev/learn/keeping-components-pure) | Keep rendering separate from mutations and side effects. |
| [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) | Keep derived display data and event work out of Effects. |
| [React: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure) | Avoid redundant state when deciding whether to extract a hook or state owner. |
| [React: Sharing State Between Components](https://react.dev/learn/sharing-state-between-components) | Locate shared state at the nearest common owner. |
| [React: Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) | Extract reusable stateful logic without conflating it with shared state. |
| [React: eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks) | Preserve static component and hook boundaries. |
| [Next.js: Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) | Treat `app/` as the filesystem routing layer. |
| [Next.js: Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) | Keep pages and layouts as route-level composition. |
| [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) | Choose the smallest Client Component boundary and serializable props. |
| [Next.js: `use client`](https://nextjs.org/docs/app/api-reference/directives/use-client) | Understand the client module-graph boundary. |
| [Next.js: Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) | Distinguish server-side composition from client-side data access. |
| [Testing Library: Guiding Principles](https://testing-library.com/docs/) | Keep component ownership aligned with observable user behavior. |
| [Vercel React Best Practices](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md?plain=1) | Supplementary architectural cross-check; performance guidance is out of scope. |

## Local conventions this skill preserves

- `client/AGENTS.md` defines the project-specific API boundary, TanStack Query
  usage, localization, vendored shared contracts, and UI primitives.
- Existing `react-best-practices`, `next-best-practices`, and
  `react-testing-library` skills remain the authority for their specialised
  subjects.
- All frontend code runs in an untrusted browser context; secrets and privileged
  actions remain server-side, and client-side checks are not authorization.
