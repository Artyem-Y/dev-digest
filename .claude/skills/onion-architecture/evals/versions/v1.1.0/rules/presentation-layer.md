# Presentation and inbound adapters

Fastify routes, job consumers, and SSE handlers translate an external protocol
to an application use case and translate its result back. They do not own the
business workflow.

## HTTP routes

- Declare/consume request and response schemas at the transport boundary using
  the shared Zod contracts and Fastify Zod type provider.
- Resolve request identity and tenant context through
  `modules/_shared/context.ts` (`getContext`); do not manually trust workspace
  or user identifiers from arbitrary headers or request bodies.
- Convert validated transport input into an application-owned command and call
  the relevant use case/service.
- Map successful application results to HTTP. Let the shared error handling
  path translate known application errors rather than duplicating it in each
  handler.
- Keep direct Drizzle access, provider calls, and multi-step workflow decisions
  out of new route handlers.

Routes may do small protocol-specific branching, such as selecting a status
code or response schema. The rule is not that every handler must have exactly
three statements; it is that business policy and reusable orchestration live
in application code.

## Jobs and SSE

Treat job handlers and SSE endpoints as inbound adapters. A job payload or
stream request is external input: validate it, establish the needed trusted
context, call the application capability, and translate progress/results. Do
not put a second copy of the use case in the job/SSE handler.
