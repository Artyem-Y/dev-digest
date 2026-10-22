---
name: devdigest-security-review
description: Review DevDigest changes for concrete trust-boundary vulnerabilities across Fastify, Next.js, Zod, Drizzle/Postgres, GitHub/git/LLM adapters, and secrets handling.
---

# DevDigest Security Review

Use this skill for a completed DevDigest change that touches an untrusted input,
authorization decision, external adapter, secret boundary, persisted user data,
or user-visible rendering. Report only evidenced source-to-sink vulnerabilities.

## Trace the actual boundary

For every changed path, identify the input source, validation and authorization
point, storage or outbound adapter, and returned or rendered output. Use the
current package instructions and implementation as the source of truth.

Focus on the boundaries that exist in DevDigest:

- Fastify routes: request parsing, Zod validation, workspace/repository/PR
  scope, authentication, authorization, error mapping, and rate limits where
  abuse cost exists.
- Next.js client: route and workspace context are UX controls only; trace the
  corresponding server enforcement. Treat rendered external, GitHub, and
  model-derived content as untrusted until the rendering boundary proves safe.
- Drizzle/PostgreSQL: tenant/workspace filters, parameterized queries,
  transaction boundaries, migration direction, and exposure of rows or errors.
- GitHub, local git, scraper, LLM, and MCP adapters: user-controlled URLs,
  repository references, prompts, tool arguments, timeouts, output size, and
  cross-workspace data disclosure.
- Secrets: use the server secrets provider as the runtime chokepoint. Never
  inspect, print, or place secret values in source, fixtures, plans, findings,
  or logs.
- Shared contracts: verify both vendored copies when a public contract crosses
  client and server.

## Report evidence, not patterns

Report a finding only when all are present:

1. an attacker-controlled or otherwise untrusted source;
2. a reachable unsafe sink or missing enforcement point;
3. `path:line` evidence for the flow and its impact; and
4. a minimal remediation that preserves the approved behavior.

If any link is unknown, record a question or **Not reviewed**. Do not claim a
vulnerability from a framework-specific pattern belonging to another stack.
Keep architecture-only concerns for the architecture reviewer.

## Required review coverage

Select only applicable checks: horizontal and vertical authorization,
workspace isolation, SSRF and outbound-network control, command/path handling,
prompt/tool-injection boundaries, XSS or unsafe URL rendering, sensitive
logging, error disclosure, denial-of-service limits, and dependency changes.
For changed authentication or authorization, require a negative test or other
fresh evidence for the denied path.
