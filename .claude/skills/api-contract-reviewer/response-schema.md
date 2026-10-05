# Response schema

Require backwards-compatible response shapes: do not remove fields, narrow accepted values, or make formerly optional fields required without a versioned migration.

Good: add an optional `display_name` field.

Bad: make `email` required in an existing response contract.
