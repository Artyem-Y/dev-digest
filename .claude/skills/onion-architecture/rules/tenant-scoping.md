# Tenant scoping in persistence operations

When reviewing changes that read or modify tenant-owned records, trace the trusted tenant or actor context from the inbound boundary through the use case into the repository operation.

- Check the actual Drizzle predicate on every tenant-owned read, list, update, and delete. A repository function accepting `workspaceId` or `accountId` does not provide isolation if the query does not use it.
- Scope writes by both the record identifier and its owning tenant when the schema permits it. Do not assume that a caller-supplied resource ID is authorization.
- Check that the use case gets tenant context from authenticated request context or validates membership before using it. Do not trust an unverified tenant ID from request input.
- Keep authorization decisions in application code and tenant predicates in repository code. Do not move SQL into routes to address a scoping gap.
- Avoid flagging global or intentionally shared records when the code and schema establish that they are not tenant-owned. State uncertainty when ownership cannot be established from the available evidence.

For a review, cite the changed query or the missing propagation/authorization step. Recommend the smallest correction that enforces the existing ownership boundary.
