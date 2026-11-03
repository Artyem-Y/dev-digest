# Validation by boundary

Each layer validates a different kind of claim. Avoid duplicating the same
business rule at every layer, while retaining database constraints as a
concurrency-safe integrity boundary where required.

| Boundary | Question it answers | DevDigest location |
|---|---|---|
| Transport | Is the incoming HTTP/message shape valid? | Zod schema at the route or message adapter |
| Application | Is this operation allowed now, with this actor and loaded state? | Application use case/service and its ports |
| Domain | Does this value preserve an invariant of the business concept? | Pure domain constructor/guard/policy |
| Persistence | Can invalid or conflicting data be stored under concurrent access? | Drizzle schema and PostgreSQL constraints/migrations |

HTTP shape checks belong at the boundary. They do not replace application
authorization, domain invariants, or database integrity. Conversely, do not
repeat an HTTP string-length check in the domain if it has no domain meaning.

Do not put database reads or provider calls in a Zod refinement. If validation
needs external state, express it as an application use case dependency. Keep
domain code free of Zod; use plain guards or domain-owned result/error types.
