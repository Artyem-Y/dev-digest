# Onion Architecture for DevDigest Backend

Version: 1.0.0

This skill applies the Onion dependency rule to DevDigest's Fastify,
TypeScript, Zod, Drizzle, PostgreSQL, background-job, SSE, and external-adapter
stack. It is intentionally migration-aware: new and substantially changed code
must point inward, but the skill does not authorize unrelated rewrites of
existing modules.

## Scope

The application core owns domain rules, use cases, and ports. Fastify, Zod,
Drizzle, PostgreSQL, external services, and the DI container are outside the
core. Infrastructure implements application-owned ports; composition selects
those implementations.

The skill does not impose a separate domain layer for a trivial endpoint and
does not require an interface around every helper. A port is justified when a
use case needs an external capability that should be isolated, varied, or faked
in a test.

## Source register

Sources were reviewed on 2026-10-01. The first two sources define the
architectural principle; framework and database documentation maps it to the
actual DevDigest stack.

| Source | Used for |
|---|---|
| [Jeffrey Palermo — The Onion Architecture](https://jeffreypalermo.com/2008/07/) | Original dependency rule: coupling points toward the center and infrastructure remains external. |
| [Alistair Cockburn — Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture) | Ports and adapters, including running and testing an application independently of UI and database. |
| [Fastify Plugins](https://fastify.dev/docs/v5.3.x/Reference/Plugins/) | Plugin encapsulation and adapter registration boundaries. |
| [Fastify Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) | Request/response validation as an HTTP boundary. |
| [Fastify Type Providers](https://fastify.dev/docs/v5.5.x/Reference/Type-Providers/) | Typed transport schemas without leaking transport types inward. |
| [Zod Basic Usage](https://zod.dev/basics) | Runtime parsing at the input boundary and typed parsed results. |
| [Drizzle Schema](https://orm.drizzle.team/docs/sql-schema-declaration) | Schema as the source of truth for queries and migrations. |
| [Drizzle Transactions](https://orm.drizzle.team/docs/transactions) | Infrastructure implementation of atomic persistence work. |
| [PostgreSQL: Data Consistency Checks](https://www.postgresql.org/docs/current/applevel-consistency.html) | Limits of application-level consistency checks under concurrent access. |
| [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | Transaction isolation and the need to bound atomic work around integrity requirements. |

## Local conventions preserved

- `server/AGENTS.md` remains the source for module ownership, immutable
  migrations, request scope, secrets, rate limits, and verification commands.
- `fastify-best-practices`, `drizzle-orm-patterns`, `zod`, and `security` retain
  responsibility for their specialised concerns.
- `src/platform/container.ts` is the composition boundary; tests use container
  overrides and mocks rather than real external services whenever possible.
