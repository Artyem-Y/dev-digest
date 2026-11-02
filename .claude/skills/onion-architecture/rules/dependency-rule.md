# Dependency direction

Compile-time imports point inward. Runtime calls can go outward through a port
declared by application code and implemented by infrastructure.

| From | May depend on | Must not depend on |
|---|---|---|
| Domain | TypeScript, domain-owned types and pure domain policies | Fastify, transport Zod schemas, Drizzle, PostgreSQL, SDKs, environment/config, `Container`, infrastructure |
| Application | Domain, application-owned ports, command/result types, narrow application-facing APIs | Fastify request/reply, transport schemas, Drizzle/schema rows, concrete adapters/SDKs, environment/config, `Container` in new code |
| Infrastructure | Domain and application contracts, Drizzle/PostgreSQL, concrete SDKs needed by an adapter | Fastify request/reply, route handlers, application service implementations |
| Presentation / inbound adapter | Fastify, shared Zod contracts, request-context helper, application API | Direct persistence for new workflows, concrete outbound adapters, business policy implementation |
| Composition | All concrete implementations and constructors needed to wire the application | Request-specific business decisions |

## Boundary examples

- A route calls a use case/service; it does not import a repository and bypass application orchestration.
- An application-owned repository port returns application/domain types; the implementation maps Drizzle rows before returning.
- A port describes the capability the use case needs. It does not re-export a Drizzle transaction, SDK client, `FastifyRequest`, or whole container.
- An infrastructure adapter may import its port and provider SDK. It does not import a route to obtain HTTP types.
- Cross-module calls use the other module's application-facing service/facade or an explicitly wired port. Do not reach into another module's repository implementation.

Use type-only imports when a runtime dependency is unnecessary, but remember
that type-only imports still create compile-time coupling and must obey the rule.

## Legacy exceptions

Existing code may contain routes with direct Drizzle access or services that
receive `Container`. Do not report those as newly introduced violations when the
task leaves them untouched. Do not reproduce the pattern in new code. When
modifying one, correct only the path needed for the requested behavior and note
any intentional remaining exception in review context.
