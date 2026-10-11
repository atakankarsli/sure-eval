---
schema_version: sure.contract/v1
id: checkout.failure
severity: error
evidence: code
scope:
  - src/features/checkout/**
context:
  - src/domain/cart.ts
  - src/domain/orders.ts
---
# Checkout failure

## CHK-001 — Preserve the cart
Given a non-empty cart, when order submission fails (the service resolves
with ok: false or the request throws), the cart's items and quantities must
remain unchanged.

## CHK-002 — Do not show success
When order submission fails for any reason, including a failure result with
an empty error message, checkout must not enter the success state.

## CHK-003 — Allow another attempt
After a failed submission settles, `submitting` must be false so the
customer can submit again.
