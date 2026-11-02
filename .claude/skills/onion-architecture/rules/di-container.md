# Composition and dependency injection

Composition is the only place that selects concrete implementations. In this
repository that boundary is shared between feature `composition.ts` factories,
module bootstrap, and `src/platform/container.ts`.

## Wire narrow dependencies

Feature composition may read concrete dependencies from the platform container,
construct repositories/adapters, and pass only what the application service
needs:

```ts
export function createFeatureService(container: Container): FeatureService {
  return new FeatureService({
    repository: new FeatureRepository(container.db),
    github: container.github,
  });
}
```

The service/application code should not receive the whole container in new
paths. Routes may use the container at the inbound edge to resolve request
context and create the feature service; that does not make the container an
application dependency.

The platform container owns cross-cutting concrete providers and shared
facilities such as secrets, auth, DB, jobs, and run bus. Do not create a second
global service locator or instantiate concrete SDKs in application code.

## Tests

- Unit-test domain/application behavior with fake ports and no real provider,
  database, Docker, Git, or GitHub dependency.
- Use `app.inject()` and container overrides for HTTP adapter tests.
- Use PostgreSQL integration tests only for repository/transaction behavior
  that needs the real database; name DB-backed tests `*.it.test.ts`.
- Test an external adapter at its contract boundary. Do not use a real external
  service where a deterministic mock proves the behavior.

The container is a production composition mechanism, not the default mocking
mechanism for every application unit test.
