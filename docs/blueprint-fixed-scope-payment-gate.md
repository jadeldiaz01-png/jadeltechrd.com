# Blueprint US$250 — PREPARE_ONLY / human-gated payment design

## Scope and authority

This proposal creates **no** payment link, PayPal order, quote acceptance, invoice, capture, refund or settlement. The homepage continues to advertise **from US$250**; the bilingual Blueprint landing proposes a more tightly bounded, one-workflow US$250 entry package. It is not a customer contract until reviewed and accepted.

The pure helper `prepareBlueprintFixedQuotePreview` is **not wired to a public or admin route**. It is intentionally isolated so it cannot bypass the canonical `project_id → quote_id → payment_order_id → provider_order_id → verified PayPal event → ledger/settlement` chain.

## Proposed deliverables (human confirmation required)

- One remote discovery meeting about one business process.
- A current-state process map, suggested architecture, prioritized backlog and one clarification round for the resulting document.
- Digital planning only; no software implementation, licensing, deployment, production integration, third-party subscriptions or ongoing support.
- Timeline, legal terms, refunds/cancellations, merchant eligibility, taxes, fee treatment and account readiness require owner review before selling.

## Promotion gates (separate approvals)

1. Verify the business PayPal account, applicable country/merchant capabilities and correct provider credentials without exposing secrets.
2. Approve the **specific fixed scope**, USD 250 price, fulfillment/cancellation terms and any mandatory disclosures.
3. Validate the canonical server-side catalog/offer binding and enforce one-workflow-only eligibility before generating an issued quote. Out-of-scope requests stay on custom quotation.
4. Reproduce negative tests and Sandbox-only contract checks: mismatched service, changed amount, reused order, unaccepted quote, invalid provider redirect, missing signed event and missing reconciliation must fail closed.
5. Independently review CI, protected base SHA, current PR HEAD, branch rules, exact changed files and static-link security.
6. Obtain a separate owner authorization for **merge** and a further distinct authorization for **manual Pages deployment** (and for any Worker/D1 change).
7. PayPal LIVE order creation and each real capture require their existing separate exact-SHA human gates. Do not enable them by merging this proposal.
8. Do not claim paid revenue unless a signed provider event, linked payment order and human ledger reconciliation agree.

## Current implementation boundary

Public CTAs still lead only to `/solicitar-proyecto.html` with the registered `offer_id=automation_blueprint`. No generic PayPal URL is embedded. The fixed-price quote preview is offline **PREPARE_ONLY** and has no external side effects. `PRODUCTION_AUTHORIZED=false`, `FINANCIAL_EXECUTION_AUTHORIZED=false`, `MAX_AUTONOMOUS_CAPITAL_USD=0` remain unchanged.

## Test commands (CI on PR)

```sh
python3 -m unittest discover -s tests -p test_ai_blueprint_landing.py -v
node --test commercial-runtime/test/blueprint-fixed-scope.test.mjs
node --test commercial-runtime/test/*.test.mjs
node --check commercial-runtime/src/blueprint-fixed-scope.mjs
node scripts/validate-agent-commerce-discovery.mjs
git diff --check
```

No steps above create real PayPal orders, send communications or deploy.
