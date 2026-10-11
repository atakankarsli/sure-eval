---
schema_version: sure.contract/v1
id: orders.validation
severity: error
evidence: code
scope:
  - src/server/**
context:
  - src/domain/catalog.ts
  - src/domain/orders.ts
---
# Order validation

## ORD-001 — Rejection leaves stock alone
If any line of an order asks for more than the available stock, the order is
rejected and no inventory changes, including for lines that had enough stock.

## ORD-002 — Server prices
The committed order uses unit prices from the server catalog, never a price
supplied by the client.

## ORD-003 — Rejection commits nothing
An order rejected by validation creates no committed order.
