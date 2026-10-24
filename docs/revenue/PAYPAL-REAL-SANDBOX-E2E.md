# PayPal real sandbox sales-to-cash certification

This path validates the real PayPal **sandbox** transport without enabling live PayPal credentials or real-money settlement.

## Required GitHub Actions secrets

Create these secrets without pasting their values into repository files, issues, pull requests, logs, or chat messages:

- `PAYPAL_SANDBOX_CLIENT_ID`
- `PAYPAL_SANDBOX_CLIENT_SECRET`
- `PAYPAL_SANDBOX_ADMIN_TOKEN` — a random value of at least 32 characters used only by the isolated sandbox Worker.

The workflow reuses the existing protected Cloudflare credentials from the `d1-recovery-drill` and `jadeltechrd` environments.

The `d1-recovery-drill` environment must also define `CLOUDFLARE_D1_READONLY_API_TOKEN`, scoped to read/query access for the isolated Sandbox D1 only. It is separate from `CLOUDFLARE_D1_API_TOKEN`, which the preparation phase uses for database creation, migrations, and synthetic seeding. The certification phase performs SQL `SELECT` queries only with the read-only token; it fails closed if that secret is absent.

It creates or reuses only the isolated resources:

- D1: `jadel-commercial-paypal-sandbox`
- Worker: `jadel-commercial-paypal-sandbox`

It does not write to the production D1 `jadel-commercial-runtime`.

## Phase 1: prepare

Dispatch `.github/workflows/paypal-real-sandbox-e2e.yml` with `phase=prepare`.

The run deploys the isolated Worker with `PAYPAL_ENVIRONMENT=sandbox`, registers or reuses its exact PayPal sandbox webhook, seeds a disposable `POLICY_ALLOWED` project, and exercises the existing handlers through:

`POLICY_ALLOWED → QUOTED → CUSTOMER_APPROVED → PAYMENT_PENDING`

It then creates a **US$1.00 virtual sandbox order** using the PayPal Orders API. The job summary contains the PayPal sandbox order ID and buyer approval URL.

Open that URL with a PayPal **sandbox Personal** buyer account and approve the order. Sandbox funds are virtual.

## Phase 2: capture_certify

After buyer approval, dispatch the workflow again with:

- `phase=capture_certify`
- `paypal_order_id=<sandbox order id from phase 1>`

The run requires the order to be `APPROVED`, captures it through `api-m.sandbox.paypal.com`, requires a `COMPLETED` sandbox capture, waits for the real signed `PAYMENT.CAPTURE.COMPLETED` webhook, correlates the exact capture ID, and invokes the existing settlement handler.

Certification passes only when authoritative sandbox D1 state is:

- project: `PAID`
- payment order: `COMPLETED`
- ledger: `MATCHED`
- webhook event: `PAYMENT.CAPTURE.COMPLETED`
- webhook verification: `VERIFIED`
- settlement: `MATCHED`

## Automatic-capture certification

Dispatch `phase=prepare_auto`, approve that order with a Sandbox Personal buyer, then dispatch `phase=auto_capture_certify` with the same `paypal_order_id`. If the order is already `COMPLETED`, this phase only observes its capture, replays the existing webhook event, and verifies settlement state; it must not call the PayPal capture endpoint again.

For automatic certification, the provider phase does not query D1 with its Worker deployment token. The isolated certification job uses `CLOUDFLARE_D1_READONLY_API_TOKEN` to discover the settlement linked to the exact payment order, ledger row, and capture, and requires exactly one matching settlement.

The evidence artifact hashes provider and internal identifiers instead of publishing their raw values.

## Production boundary

This workflow does not authorize live PayPal credentials. The production Worker keeps the default PayPal environment as `live` and remains fail-closed while live credentials are absent.

Moving from sandbox certification to live credentials requires a separate reviewed change and explicit human authorization.
