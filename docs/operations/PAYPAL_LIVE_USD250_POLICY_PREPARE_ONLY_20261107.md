# PayPal LIVE — bounded US$250 policy preparation (2026-11-07)

Status: PREPARE_ONLY. This document records proposed source changes and does **not** authorize or demonstrate an active PayPal checkout.

## Why this patch

The owner previously approved a **US$250** maximum capture amount per customer-approved order (25,000 USD minor units) with zero autonomous capital. The currently deployed production configuration is explicitly fail-closed: PayPal order creation, capture, auto-reconciliation, financial execution and subscriptions are disabled; the visible capture limit is 0. The repository's later activation workflow and site copy incorrectly used **US$14,800** (1,480,000 USD minor units).

This draft PR aligns:
- Manual LIVE activation configuration to an exact maximum of **25,000 minor units**, only for buyer-approved USD upfront payments, and preserves all existing quote/order/project checks.
- Governed single-order capture and read-only postactivation audits to the same ceiling.
- PayPal webhook-update version verification to the same ceiling.
- The activation workflow's subscriptions flag to **false**, keeping future recurring billing explicitly separate.
- Static and JS-rendered website copy: intake and quotes can be requested, while LIVE order creation and capture remain disabled until readiness gates have passed. No past or present payment is claimed.
- Existing Security baseline and copy/test contracts.

## Safety boundaries

The patch is **not** a payment, live activation, release or change to the running Worker. It does not modify provider credentials, GitHub Secrets, Cloudflare bindings, D1 customer records, API permissions, merchant settings or the immutable service-discovery catalog.

Never run `paypal-live-activate.yml` before approved independent review, verified active-version audits, verified PayPal app-to-Worker credential identity, successful Sandbox evidence, safe rollback rehearsal and an explicit single deployment decision. An autonomous invoice or purchase must not be used as a no-cost readiness test.

For comparison, `payPal-live-preactivation-readonly.yml` is proposed separately in the preactivation-audit PR; it checks the current disabled production state without requiring capture enabled. Do not confuse preactivation PASS with payment processing PASS.

## Commercial and financial states

- Inquiry received: not a payment.
- Accepted quote: not a payment.
- Buyer-approved PayPal order: not yet a completed capture.
- `PAYMENT.CAPTURE.COMPLETED` **and** authenticated exact-order reconciliation: evidence supporting `PAID`.
- D1 settled revenue last evidenced 2026-11-07: USD 0.00. No positive live reconciliation proven yet.

Production status: **HOLD**. This draft must not be merged or deployed without final verification.
