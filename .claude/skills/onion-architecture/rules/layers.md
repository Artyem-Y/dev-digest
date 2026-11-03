# Layer map and placement

The layer names describe ownership and dependency direction. They do not require
every feature to use a fixed directory tree.

| Layer | Current locations | Responsibilities |
|---|---|---|
| Presentation / inbound | `src/modules/<feature>/routes.ts`, job and SSE handlers | Parse/validate external input, resolve request context, call application behavior, translate results/errors/events |
| Application | Existing `service.ts`; `application/` for new paths that benefit from explicit use cases | Orchestrate the workflow, enforce application preconditions and authorization, define commands/results and ports |
| Domain | `domain/` where policies or invariants justify it; some shared public contracts live in vendored `@devdigest/shared` | Pure business rules, invariants and value objects |
| Infrastructure / outbound | `repository.ts`, `repository/`, `infrastructure/`, `src/adapters/` | Persistence, external clients, queues, filesystem, process and other I/O |
| Composition | Feature `composition.ts`, `src/platform/container.ts`, module bootstrap | Select concrete implementations and wire application dependencies |

## Placement questions

1. Is the code specific to an incoming/outgoing protocol? Put it in an adapter.
2. Does it decide or coordinate a business operation? Put it in application code.
3. Does it express an invariant that remains true without I/O? Put it in domain code when that makes the rule clearer or reusable.
4. Does it perform I/O? Put it in an adapter/repository implementing the application-facing contract.
5. Does it choose concrete implementations? Put it at composition.

For a small endpoint, keep the established shape and avoid ceremonial folders.
Separate domain policy when it has independent meaning; add ports when use cases
need an external capability isolated, varied, or faked.

## Jobs and SSE

Job consumers and SSE handlers are inbound adapters just like routes. They may
deserialize a message, establish trusted scope, invoke a use case, and translate
events. They must not become the only home for a workflow's business rules.

## Existing module migration

Some older services use `Container` or combine responsibilities. Treat those as
migration seams. A new feature or substantially changed path should follow the
current boundaries, but unrelated modules are not part of the change by default.
