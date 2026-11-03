# Infrastructure and outbound adapters

Infrastructure performs I/O and implements contracts used by application
code. It includes feature repositories, outbound provider adapters, and shared
adapters under `src/adapters/`.

## Persistence boundary

- Keep Drizzle schema/query code, PostgreSQL row types, and migrations here.
- Keep `$inferSelect` / `$inferInsert` internal to the persistence boundary.
- Map rows into application/domain results before they leave the repository.
- Keep provider-specific values behind provider adapters and map them to the
  capability's application-facing result.
- Do not let repositories import Fastify, routes, or service implementations.

## Authorization and tenant scoping

Repositories must preserve workspace/user scoping passed from the application
use case. Include the tenant predicate in every query that reads or mutates
tenant-owned data; do not rely on a client-side check or a prior unscoped read.
The use case remains responsible for the business permission decision, and the
repository enforces the scope of the operation it executes.

## Transactions and integrity

Keep transaction mechanics inside the repository or infrastructure unit of
work. Bound the transaction to the writes that must commit or roll back
together. Use PostgreSQL constraints for invariants that must survive concurrent
requests; an application read-then-write check alone may race. Preserve the
repository migration rules: committed SQL and migration metadata are immutable;
make schema changes forward with a new migration.

Avoid adding a sub-repository/facade hierarchy without a real ownership or
complexity need. Follow the feature's existing repository organization unless
the requested change requires a new boundary.
