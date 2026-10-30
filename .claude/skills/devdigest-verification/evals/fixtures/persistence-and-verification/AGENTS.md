# Fixture instructions

The Drizzle schema is the source for schema changes. Existing migrations and
metadata are immutable. Database-backed tests use the `.it.test.ts` suffix and
require a real PostgreSQL environment.
