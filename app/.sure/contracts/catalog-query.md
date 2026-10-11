---
schema_version: sure.contract/v1
id: catalog.query
severity: error
evidence: code
scope:
  - src/features/catalog/**
context:
  - src/domain/catalog.ts
---
# Catalog query

## CAT-001 — Paging keeps the filter
Moving to the next page keeps the selected category: the request for the
next page asks for the same category, and every returned item belongs to it.

## CAT-002 — Filtering starts at page one
Changing the category always returns to the first page.

## CAT-003 — Newest query wins
When an earlier request resolves after a newer one, its results must not
replace the newer query's results.
