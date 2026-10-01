---
name: onion-architecture
version: 1.0.0
description: Use when creating or substantially changing a DevDigest backend module, use case, repository, job, SSE flow, or external integration. Enforces Onion Architecture dependency direction for Fastify, Zod, Drizzle, PostgreSQL, and platform adapters.
---

# Onion Architecture for DevDigest Backend

Apply Onion Architecture to new and substantially changed code in `server/`.
The dependency rule is mandatory: compile-time dependencies point toward the
application core, never toward Fastify, Drizzle, PostgreSQL, external clients,
or the DI container.

Do not use this skill to justify a broad rewrite of an unrelated legacy module.
Preserve existing code outside the task boundary, but do not introduce a new
outward dependency in code you create or substantially refactor.

Read [README.md](README.md) when updating these rules or when architectural
trade-offs need source context.

## Rings and dependency direction

```text
Fastify routes, jobs, SSE                         inbound adapters
                         ↓
Application use cases and ports                   application ring
                         ↓
Domain policies, value objects, invariants        core ring
                         ↑
Drizzle/Postgres, GitHub, Git, LLM, secrets       outbound adapters
                         ↑
Container/module bootstrap                        composition boundary
```

An outer ring may import an inner ring. An inner ring must not import an outer
ring. The database is infrastructure, not the application center.

## Placement and allowed dependencies

| Concern | DevDigest location | May depend on | Must not depend on |
|---|---|---|---|
| Domain policy, value object, invariant | `src/modules/<feature>/domain/` | TypeScript standard library and other domain modules | Fastify, Zod, Drizzle, database rows, adapters, `Container` |
| Use case and command/result types | `src/modules/<feature>/application/` | Domain and application-owned ports | Fastify request/reply, Drizzle, concrete adapters, `Container` |
| Inbound port | `application/ports/` | Domain/application types | Fastify and infrastructure imports |
| Outbound port | `application/ports/` | Domain/application types | Drizzle, `postgres`, GitHub/LLM SDK types |
| HTTP adapter | `src/modules/<feature>/routes.ts` | Fastify, shared Zod contracts, application API | Business-rule implementation and direct persistence for new flows |
| Repository or external implementation | `src/modules/<feature>/infrastructure/` or the existing `repository/` area | Application port plus Drizzle or a concrete client | Fastify request/reply |
| Cross-cutting external adapter | `src/adapters/**` | Its application-facing port and concrete SDK | Route-specific types or business policy |
| Composition | `src/platform/container.ts` or a module bootstrap called by it | Concrete adapters and application constructors | HTTP request-specific data |

For a trivial route with no business behavior, a distinct `domain/` folder is
not required. It must still keep transport parsing and persistence details out
of any reusable application policy. Create a port only when application logic
needs to vary, fake, or isolate an external dependency; do not create an
interface for a private pure helper.

## Adapter rules for the current stack

### Fastify and Zod

- `routes.ts` is an inbound adapter. It obtains request scope through
  `modules/_shared/context.ts`, accepts validated transport input, invokes a use
  case, and maps application errors/results to HTTP.
- Shared Zod schemas and the Fastify Zod type provider belong at the transport
  boundary. Do not make a domain policy accept a `FastifyRequest` or a Zod
  schema as its dependency.
- SSE handlers and background-job handlers are inbound adapters too. They may
  start a use case and translate events, but do not own the workflow's business
  decisions.

### Drizzle and PostgreSQL

- Drizzle schema, queries, transactions, migrations, and PostgreSQL row shapes
  are infrastructure. A repository implements an application-owned outbound
  port and maps persistence data at that boundary.
- A use case decides that a workflow must be atomic; a transaction runner or
  unit-of-work port expresses that need. Do not pass a Drizzle transaction into
  domain or application code.
- Keep committed migration history immutable. The current Drizzle schema is the
  source for a new migration, and database constraints remain a final integrity
  boundary rather than a substitute for application rules.

### External systems and composition

- GitHub, Git, LLM, secrets, job queue, repository-intel, and run-bus clients
  are outbound adapters. Application code depends on narrow ports that describe
  the needed capability, not on the full `Container`.
- Only composition code chooses concrete implementations. Existing services
  that receive `Container` are legacy migration boundaries; do not copy that
  shape into a new use case.
- Secrets never enter domain values, logs, transport contracts, or tests.

## Change workflow

1. Identify the use case and its business invariant before selecting files.
2. Put pure policy in `domain/` when it has domain meaning; otherwise keep
   orchestration in `application/`.
3. Define an application-owned port before adding an external dependency to the
   use case.
4. Implement the port in infrastructure with Drizzle or the relevant adapter.
5. Wire concrete dependencies at the composition boundary.
6. Keep the route, job, or SSE handler thin: validate, resolve scope, call the
   use case, and translate its result.
7. For a touched legacy path, improve only the dependency violation necessary
   for the change. Record an intentional remaining exception in review notes.

## Testing by ring

| Ring | Test style |
|---|---|
| Domain/application | Hermetic unit test with fake ports; no Fastify, Drizzle, Docker, GitHub, Git, or LLM. |
| HTTP/SSE adapter | `app.inject()` with container overrides and mocked ports/adapters. |
| Repository/transaction | `*.it.test.ts` with Testcontainers and a real PostgreSQL database. |
| External adapter | Contract-focused unit test or integration test only when the behavior belongs to that provider boundary. |

Do not mistake a client-side or transport-level check for authorization. A use
case must receive the relevant actor/workspace context and enforce the business
permission through its policy and ports; protected server operations remain the
authority.

## Review checklist

Before finishing, verify:

1. Does domain/application import a framework, ORM, driver, SDK, environment
   config, or `Container`? If yes, move or invert the dependency.
2. Does an inner layer define the port used by the outer implementation?
3. Does a route/job/SSE handler contain a business rule or direct new Drizzle
   workflow that belongs in a use case or repository?
4. Are transaction scope and persistence constraints sufficient for the stated
   invariant?
5. Can the changed domain/application behavior run with fakes rather than real
   infrastructure?
6. Did the change preserve server-side authorization and avoid leaking secrets?
