# Domain layer

The domain contains rules that remain true regardless of HTTP, database, model
provider, or job runner.

## Put here

- Pure calculations and policies with business meaning.
- Value objects or entities when construction must enforce invariants.
- Domain-owned types that are not merely persistence rows or transport DTOs.
- Domain-specific error/result types that do not depend on platform error code.

Do not create a `domain/` directory for a trivial endpoint with no reusable
policy. `@devdigest/shared` contracts are public cross-package contracts; do
not assume they are the right place for every internal domain model.

## Keep dependencies inward

Domain code must not import Fastify, Zod, Drizzle, `postgres`, an SDK, the
platform container, environment configuration, or secrets. Keep pure guards in
TypeScript. Translate a domain result/error into the platform/API error shape
at the application or presentation boundary.

```ts
export function assertPositiveAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new InvalidAmountError(amount);
  }
}
```

The example's error should be a domain-owned type; it should not import an
outer-ring `AppError` merely to reuse an HTTP status code.

Secrets do not belong in domain values, shared contracts, error details, or
domain logs. Keep secret retrieval in the secrets/provider adapter flow.
