# PayPal LIVE + D1 revenue evidence - 2026-10-10

## Scope

This evidence run was read-only. It did not create PayPal orders, capture funds, issue refunds, modify D1, mutate secrets, send external messages or authorize autonomous financial execution.

## Executed workflows

| Control | Workflow run | SHA | Result |
| --- | --- | --- | --- |
| PayPal LIVE readiness | https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38014415775 | `9267235d66bbd21a37061e69391507d0bc3aaf38` | PASS |
| D1 revenue readiness scorecard | https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38014419224 | `9267235d66bbd21a37061e69391507d0bc3aaf38` | PASS |

## D1 revenue scorecard facts

Source of truth: `commercial_d1.sales_settlements` with `status='MATCHED'` and `currency_code='USD'`.

```json
{
  "source": "commercial_d1.sales_settlements",
  "generated_at": "2026-10-10T01:46:02Z",
  "settled_amount_minor": 0,
  "settled_payments": 0,
  "total_requests": 5,
  "qualified_leads": 0,
  "converted_customers": 0
}
```

Current settled revenue is **US$0.00**. The first milestone remains **US$250.00**.

## Artifact archive

The workflow uploaded artifact `revenue-readiness-scorecard-38014419224-1` with:

- `revenue-readiness-facts.json`
- `revenue-readiness-scorecard.json`
- `revenue-readiness-scorecard.md`
- `revenue-readiness-scorecard.sha256`

GitHub Actions retention for this artifact is 35 days.

## Pending-order read-only blocker

`paypal-live-pending-readonly.yml` is structurally safe, but its current main-branch SHA gate is stale. It requires the diff from baseline `8aafb343e4ff1fa70ee38e4a3c12fad46c3fc403` to the approved `main` SHA to contain only `.github/workflows/paypal-live-pending-readonly.yml`. Current `main` contains additional approved production changes, so the workflow should not be dispatched until the baseline gate is refreshed in a small reviewed PR.

Required next patch:

1. Update the pending-readonly baseline to the current protected main SHA.
2. Preserve the read-only contract: D1 `SELECT` only, PayPal order `GET` only, no `/capture`, no `/refund`, no D1 mutation and no secret mutation.
3. Merge after CI.
4. Dispatch `paypal-live-pending-readonly.yml` with the exact new protected main SHA and confirmation `VERIFY_PAYPAL_LIVE_PENDING_READONLY`.

## Authority boundary

PayPal LIVE capture remains blocked unless a human supplies all required identifiers for one already customer-approved PayPal order:

- PayPal order ID
- internal `payment_order_id`
- internal `quote_id`
- exact protected main SHA
- confirmation `CAPTURE_PAYPAL_LIVE_ORDER`

The capture workflow must remain single-order, idempotent and human-approved. It must never perform automatic reconciliation, refund, payout or second capture.
