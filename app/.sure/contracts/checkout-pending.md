---
schema_version: sure.contract/v1
id: checkout.pending
severity: error
evidence: code
scope:
  - src/features/checkout/**
context:
  - src/domain/orders.ts
---
# Checkout while pending

## CHK-004 — One request at a time
While a submission is pending, submitting again must not start another
order request.
