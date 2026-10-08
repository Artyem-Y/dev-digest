# Semver discipline

Require a major-version path for public incompatible API changes and document the migration for consumers.

Good: ship a breaking payload change at `/v2` with a migration guide.

Bad: silently change `/v1` response semantics in a patch release.
