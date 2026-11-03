# Revenue Readiness Scorecard

**Settled revenue:** US$0.00
**Settled payments:** 0
**Commercial requests:** 16
**Projects with a recorded qualification:** 0
**Converted customers:** 0

| Milestone | Status | Progress | Remaining |
|---|---:|---:|---:|
| US$250 | RED | 0.00% | US$250.00 |
| US$1,000 | RED | 0.00% | US$1,000.00 |
| US$5,000 | RED | 0.00% | US$5,000.00 |

Qualification count is distinct projects with at least one `qualify_lead` event in `lead_lifecycle_events`; zero recorded events does not prove zero leads were qualified.
Converted customers: distinct projects with matched USD settlements.
Source of truth for settled revenue: `sales_settlements` with `status='MATCHED'` and `currency_code='USD'`.
This cumulative scorecard does not measure gross margin or customer acquisition cost; those require per-sale fees, labor hours, and direct costs from the commercial cost ledger.
Read-only: no order creation, capture/refund, D1 mutation, secret change, or financial execution.
