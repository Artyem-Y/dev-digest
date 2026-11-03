---
name: onion-architecture
version: 1.1.0
description: >
  Apply DevDigest's inward-only backend boundaries when adding or substantially
  changing server modules, routes, services, repositories, jobs, SSE flows, or
  external integrations, and when deciding where backend code belongs. Do not
  use for unrelated legacy rewrites or detailed Fastify, Drizzle, or Zod recipes
  handled by their specialized skills.
---

# Onion Architecture for DevDigest Backend

Use this skill for new backend behavior and the path a task substantially changes.
Keep unrelated legacy code within its current boundaries; do not expand a feature
into a broad architecture migration.

The rule is compile-time dependency direction: **outer rings may depend inward;
inner rings must not depend outward.** Runtime calls to external capabilities
cross application-owned ports implemented by infrastructure.

## Rings in this repository

| Ring | DevDigest examples | Owns |
|---|---|---|
| Presentation / inbound adapters | `modules/<feature>/routes.ts`, job handlers, SSE handlers | Parse transport input, resolve request scope, invoke application behavior, map results/errors or events to transport |
| Application | `modules/<feature>/service.ts` and new `application/` code | Use cases, workflow decisions, authorization checks, commands/results, ports |
| Domain | `modules/<feature>/domain/` when domain policy warrants it | Pure business concepts, invariants, value objects and policies |
| Infrastructure / outbound adapters | `repository.ts`, `repository/`, `infrastructure/`, `src/adapters/` | Drizzle/PostgreSQL, GitHub/Git/LLM, filesystem, queues and other external I/O; implement application ports |
| Composition boundary | `modules/<feature>/composition.ts`, `src/platform/container.ts`, module bootstrap | Construct concrete dependencies and connect adapters to application code |

These are dependency boundaries, not a mandate to create every folder in every
module. Preserve the repository's established module shape when making a narrow
change. A trivial route with no reusable business behavior does not need a new
domain layer, and a private pure helper does not need an interface.

```text
Inbound adapters → Application use cases / ports → Domain policy
                         ↑                          ↑
                 Infrastructure implements ports ──┘

Composition selects and wires concrete implementations at the boundary.
```

## Fast placement guide

- Is it HTTP/SSE/job input or output translation? Keep it in the inbound adapter.
- Is it a business workflow, permission decision, or precondition? Put it in the application service/use case.
- Is it a pure invariant or business calculation independent of I/O? Put it in domain code when that separation adds value.
- Does it query Drizzle/PostgreSQL or call GitHub, Git, an LLM, secrets, the filesystem, or a queue? Put it behind an application-owned port in infrastructure or `src/adapters/`.
- Does it choose concrete classes or providers? Put it in module composition or the platform container.
- Is the task on a legacy path? Change only the boundary needed for the requested behavior and preserve the rest.

For detailed guidance, read only the relevant rule:

- New module or layer placement: [rules/layers.md](rules/layers.md)
- Import direction or cross-module dependency: [rules/dependency-rule.md](rules/dependency-rule.md)
- Domain policy and invariants: [rules/domain-layer.md](rules/domain-layer.md)
- Use cases, ports, authorization and workflow logic: [rules/application-layer.md](rules/application-layer.md)
- Repositories, adapters, scoping and transactions: [rules/infrastructure-layer.md](rules/infrastructure-layer.md)
- Fastify, request context and transport schemas: [rules/presentation-layer.md](rules/presentation-layer.md)
- Validation ownership: [rules/validation-stack.md](rules/validation-stack.md)
- Composition and test doubles: [rules/di-container.md](rules/di-container.md)

Use `fastify-best-practices`, `drizzle-orm-patterns`, `zod`, and
`postgresql-table-design` for detailed framework, query, schema, or database
design recipes. This skill decides which ring owns that work.
For architecture background and the research bibliography, see
[references.md](references.md).

## Safe change workflow

1. Trace the current route/job/SSE-to-service-to-repository path and identify existing legacy boundaries.
2. State the business invariant and the actor/workspace context the operation needs.
3. Keep wire parsing in the inbound adapter; pass application-owned inputs into the use case.
4. Keep workflow decisions in application code. Add a narrow port when an external capability must be isolated, varied, or faked.
5. Implement persistence and external I/O in infrastructure; map database/provider shapes at that boundary.
6. Wire concrete dependencies in `composition.ts` or the platform container. Do not pass the full `Container` into new domain/application code.
7. Verify the changed ring with its appropriate test and check that authorization, tenant scoping, secrets, and transaction boundaries still hold.

## Review checklist

1. Do domain or application files import Fastify, Zod transport schemas, Drizzle, PostgreSQL, an SDK, environment configuration, or `Container`?
2. Does application code depend on ports/types it owns rather than concrete adapters or persistence rows?
3. Do repository and external adapter implementations depend on the application-facing contract, without importing routes or service implementations?
4. Do routes, jobs, and SSE handlers translate input/output and delegate workflow decisions?
5. Does the use case receive trusted actor/workspace context and enforce server-side authorization? Are tenant reads/writes scoped in the repository?
6. Are multi-write invariants atomic, with database constraints protecting integrity under concurrency where needed?
7. Can domain/application behavior be tested with fakes, without real infrastructure?
8. Are secrets kept within the secrets/provider flow and excluded from domain values, transport contracts, logs and tests?
