---
schema_version: sure.contract/v1
id: cart.lines
severity: error
evidence: code
scope:
  - src/domain/cart.ts
---
# Cart lines

## CART-001 — Removing keeps other lines
Removing one SKU leaves every other line, including SKUs that share a
prefix with it, with its quantity unchanged.

## CART-002 — Adding increments
Adding a SKU that is already in the cart increases its quantity by the
added amount instead of replacing it.
