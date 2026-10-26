# Offline Sandbox checkout binding gate — PREPARE_ONLY

## Purpose
A read-only, deterministic structural verifier for a synthetic or previously retrieved **PayPal Sandbox** payment order linked to a verified, accepted `automation_blueprint` quote. This is an independent future-work PR, separate from Blueprint website preparation PR #188.

### Contract
The test fixture contains:
- An approved policy request with the canonical `offer_id=automation_blueprint` and exactly `["architecture"]`.
- `quote.status=ACCEPTED`, `project_state=PAYMENT_PENDING`, USD 250.00 and one exact architecture setup quote item.
- A pending PayPal order whose `payment_order_id`, `quote_id`, project, amount and USD currency agree.
- A synthetic HTTPS `www.sandbox.paypal.com/checkoutnow?token=<provider_order_id>` checkout URL, validated structurally and never returned to consumers.

Result states include `SANDBOX_BINDING_STRUCTURALLY_VALID` or explicit fail-closed codes. Every result is marked `authority=PREPARE_ONLY`, `evidence=STRUCTURAL_ONLY_NOT_PROVIDER_VERIFIED`, with null checkout URL and all financial side-effect flags false.

## Deliberate limitations
- **No** live PayPal authentication or account verification, **no** API request, webhook delivery, PayPal-host authenticity check, real Sandbox provider query, signed evidence, merchant eligibility, settlement, financial transaction or D1 query.
- **No** public or admin endpoint. This module is **not wired** to `worker.mjs` and must not be treated as a certified live checkout button.
- The input is a read-only candidate snapshot: before future use, server-side reads must fetch the authoritative quote, items, project and payment order. Never trust client-provided quote/order evidence.
- This does not change existing PayPal order-creation flags or LIVE workflows, **does not** enable payment capture or deploy, and does not change main branch.

## Test gate
```sh
node --check commercial-runtime/src/sandbox-quote-checkout-certifier.mjs
node --test commercial-runtime/test/sandbox-quote-checkout-certifier.test.mjs
node --test commercial-runtime/test/*.test.mjs
git diff --check
```
The `commercial-runtime` pull_request workflow runs all matching `*.test.mjs`.

## Further gates
1. Pass this isolated module's CI and independent human review on the **current** commit SHA.
2. Only in a separately authorized later PR, connect an authenticated **read-only** operator endpoint that fetches the authoritative DB records, with no public exposure and no raw URL disclosure.
3. Sandbox provider account/credential and webhook verification; verify invoice_id, custom_id, provider order status and idempotency from actual provider evidence, and test malformed/duplicate requests.
4. Commercial terms/fees/refund policy, merchant eligibility and human-approved scope.
5. Separately authorize merge, Pages/Worker deployments, PAYPAL LIVE activation and each real capture; reconcile the signed event before marking PAID. A successful test does not authorize any of these gates.
