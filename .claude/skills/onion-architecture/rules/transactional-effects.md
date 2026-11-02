# External effects and database transactions

Treat a database transaction as atomic only for database work. Do not call a remote API, publish a message, send an email, or invoke another non-transactional capability from inside a transaction callback.

The external effect cannot be rolled back with the database. If it succeeds and the database commit fails, the outside system observes a change that local state does not contain. A slow or unavailable provider also holds the database transaction open and couples local writes to provider availability.

- For effects that must reliably follow a database change, write an outbox record in the same transaction and publish it after commit. State that delivery may repeat and consumers must be idempotent.
- For best-effort effects, commit local state first, then invoke the port and handle failure/retry explicitly.
- Trace the outbox lifecycle across the application use case, business repository, outbox repository, dispatcher, and consumer. The business write and outbox insert must share one database transaction; do not mark an event delivered before the external publish succeeds.
- When delivery is acknowledged after publishing, account for a crash between publish and acknowledgement: delivery can repeat, so the consumer must deduplicate by a stable event ID or make its operation idempotent.
- Keep the port in application-owned contracts and the provider implementation in infrastructure. Do not move the external call into a route to avoid the transaction boundary.

When reviewing, follow the event across files and cite each broken boundary. Explain commit/rollback or delivery-loss/replay consequences, then recommend the smallest outbox/acknowledgement design that fits the required delivery guarantee. Explicitly mention idempotent consumers when delivery may repeat.
