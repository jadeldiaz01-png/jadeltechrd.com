# Revenue Infrastructure Research - 2026-09-22

## Objective

Move `jadeltechrd.com` from a static commercial page toward a governed revenue intake surface without exposing private Nexus control-plane endpoints, secrets, payment execution, social publishing or trading automation.

## Current public posture

- Public catalog and pricing are live.
- PayPal Payment Links are available for selected services.
- The governed project intake explains Turnstile, rate limiting, idempotency, evidence and human approval.
- Nexus may prepare briefs, scoring, tasks, artifacts and reports, but public pages must not grant autonomous authority over money, contracts, publishing, OAuth scopes, infrastructure changes or real trading.

## External evidence

- PayPal Payment Links are the lowest-risk first checkout path because they can be created in the PayPal business dashboard and shared on a website without custom payment code. Source: https://developer.paypal.com/payment-links-buttons/overview/
- The PayPal Payment Links and Buttons API can create payment links, but it requires backend credentials and should remain behind server-side secret management. Source: https://developer.paypal.com/api/payment-links-buttons/
- Cloudflare D1 is Cloudflare's managed serverless SQL database with SQLite semantics, disaster recovery, and Worker/HTTP API access, making it suitable for intake and ledger records. Source: https://developers.cloudflare.com/d1/
- Cloudflare Workflows support durable multi-step execution, retries, state persistence and waiting for external events, which fits human approval and reconciliation flows. Source: https://developers.cloudflare.com/workflows/
- OWASP Top 10 for LLM and Generative AI Apps identifies agentic and LLM application risks that require mitigations across development, deployment and operations. Source: https://genai.owasp.org/llm-top-10/
- NIST AI RMF is intended to help incorporate trustworthiness into AI product and service design, development, use and evaluation. Source: https://www.nist.gov/itl/ai-risk-management-framework

## Production revenue gates

1. No verified payment evidence, no fulfillment.
2. No webhook signature verification, no automated ledger entry.
3. No human approval, no external commitment, contract, publication, OAuth scope expansion or infrastructure change.
4. No trading with live capital; quant services remain research, risk architecture, testnet or supervised engineering until independent gates pass.
5. Every commercial request needs idempotency, audit IDs, retention policy, retries, structured logs and status visibility.

## Public website update

The homepage now includes a dedicated commercial infrastructure section that communicates the revenue path:

- Hosted checkout through PayPal Payment Links.
- Verifiable intake with Turnstile, limits, idempotency and durable workflow.
- Evidence ledger for payment, scope, approvals and deliverables.
- Supervised agent operation for briefs, scoring, tickets, artifacts and reporting.

## Next implementation backlog

1. Add official PayPal Payment Links for the remaining catalog services.
2. Run one low-value transaction test per link and reconcile it manually.
3. Provision PayPal webhook verification behind the backend.
4. Persist webhook, intake and approval evidence in D1 or Postgres.
5. Add an owner-only approval console with access logs and expiring approvals.
6. Export ledger and work-order status into an operational dashboard.

## 2026-09-24 P1 runtime hardening

Implemented backend hardening for the PayPal and approval path:

- PayPal webhook processing remains disabled unless `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` and D1 are configured.
- Incoming PayPal events are verified through PayPal's official webhook signature verification API before any D1 write.
- PayPal certificate URLs are constrained to official PayPal API hosts before the verification request is attempted.
- Unsupported verified webhook event types are acknowledged and ignored; they do not create revenue ledger records.
- Supported payment events map to conservative ledger states: completed sales/captures require human reconciliation; pending captures stay reconciling; denied, refunded and reversed events are rejected.
- Owner-only admin approval can reconcile a verified payment ledger row to an existing project, but this only marks evidence as matched. It does not authorize fulfillment, refunds, payouts, contracts, publication, infrastructure changes or trading.

Validated locally:

- `node --check commercial-runtime/src/worker.mjs`
- `node --test commercial-runtime/test/*.test.mjs`
- `node scripts/validate-site-production-readiness.mjs`
- `node scripts/validate-agent-manifest.mjs`
- `node scripts/validate-institutional-production-manifest.mjs`
