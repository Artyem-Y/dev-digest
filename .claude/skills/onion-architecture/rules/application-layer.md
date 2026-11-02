# Application layer

Application code implements use cases: it coordinates domain policy and the
capabilities required to complete a user or system intention.

## Own the workflow

- Define application command/input and result types; do not accept
  `FastifyRequest`, `FastifyReply`, or a wire-format schema.
- Enforce application preconditions and permission decisions that may require
  loaded state. Receive trusted actor/workspace context from the inbound edge.
- Orchestrate repository and provider capabilities through narrow ports or
  existing application-facing interfaces.
- Return application results or stable contracts, never raw Drizzle rows.
- Keep provider-specific request/response details out of the use case.

Do not make every helper a port. Add a port when the use case depends on an
external capability that must be isolated, varied, or faked. Pure computation
can remain a private function.

## Atomic workflows

The use case states which operation must be atomic. Express that need through
one repository operation or an application-owned unit-of-work/transaction
capability. The Drizzle transaction object and transaction mechanics remain in
infrastructure; do not pass them into domain policy or application code.

## Async work

An application use case can schedule long-running work through the existing job
or run capability and return the accepted operation/result. The inbound HTTP
handler does not own the background workflow. Ensure background failures are
observed and progress is emitted through the established run/SSE interface;
do not start untracked fire-and-forget promises.

## Legacy services

Several existing services accept `Container`. Keep such constructors at their
current migration boundary, but do not copy that pattern into new application
code. Use `composition.ts` to pass the service its narrow repository, provider,
clock, job, or event dependencies.
