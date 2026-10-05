# Breaking change

Flag removal or incompatible modification of a public endpoint, parameter, field, enum value, or error contract.

Good: add `/v2/orders` while retaining `/v1/orders`.

Bad: rename response field `customerId` to `id` without compatibility.
