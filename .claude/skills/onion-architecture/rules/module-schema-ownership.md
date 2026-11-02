# Cross-module schema ownership

Each feature module owns its persistence schema. A different feature module must
not import its private Drizzle table definitions or build queries by joining
against them, even when both files are in infrastructure. That couples the
caller to another module's storage representation and bypasses the owning
module's application boundary.

Use the owning module's application-facing service/facade or define an explicit
read contract/port for the needed data and wire its implementation at the
composition boundary. A shared reporting/read-model schema is acceptable only
when it is explicitly owned as a shared contract rather than borrowed from a
feature module's private schema.

When reviewing changes, cite the import or peer-table reference and name both
the importing and owning modules. Do not flag same-module schema imports or
queries against an explicitly shared read model.
