# PayPal LIVE: preactivation audit (read-only) — 2026-11-07

Status: PREPARE_ONLY / NO-GO for production capture. No payment authorization or checkout activation.

## Evidence and facts

- GitHub `main` at review: `f142a76d1d37b2e27a7a0d264b26f1f0f2e9fe12`.
- Cloudflare UI screenshot: `jadel-commercial-runtime` in Production, active version prefix `07d70774` with 100% traffic.
- Cloudflare configuration screenshots: `PAYPAL_ENVIRONMENT=live`; order creation, live order creation, capture, reconciliation, subscriptions, production authorization, financial execution all `false`; automatic capture maximum `0` minor units.
- PayPal Developer screenshots: `Jadeltechrd` application and expected webhook URL with six essential event subscriptions, **not** proof of delivered or settled payments.
- D1 read-only revenue scorecard 2026-11-07: `settled_usd=0.00` at that instant.
- The PayPal LIVE readiness workflow passed historically on 2026-10-10. It does not prove the current deployed version or an actual capture.

## Why a separate audit

The existing `.github/workflows/audit-paypal-live-worker-flags-readonly.yml` expects **capture enabled** and maximum **1480000** minor units. Running it against a purposely disabled deployment will report failure, and that alone does not mean the deployment is insecure. Do not edit its postactivation policy as a shortcut.

The new `.github/workflows/paypal-live-preactivation-readonly.yml` uses manual dispatch, an exact protected SHA, an expected 8-character version prefix, **GET-only** Cloudflare API calls, and a token sourced only from `CLOUDFLARE_D1_READONLY_API_TOKEN`. It requires exactly one active version at 100% and checks ten non-secret fail-closed flags plus presence-only checks for three PayPal secrets. It checks that the deployment ID does not change during inspection and fails closed if evidence is missing. It never prints secret values or triggers creation, capture, refund, deployments or D1 writes.

Token caveat: the pre-existing read-only D1 token may not have the Cloudflare Workers Read permission needed to inspect active versions. If so, the audit must fail with an access diagnostic. Do **not** fall back to a deployment token or weaken the scope; obtain a narrowly scoped separate token via the normal secure approval process.

## Running later, after independent review and merge

1. Confirm the latest `main` SHA and the 8-character Cloudflare active version prefix at execution time.
2. Confirm a read-only token with explicit Workers Read scope is available to the `d1-live-readonly-audit` environment; do not display credentials.
3. In GitHub Actions choose `Audit PayPal LIVE preactivation (GET-only)`, `Run workflow`, `main`.
4. Enter `expected_sha` (the **current** full 40-digit main SHA), `expected_version_prefix` (current Cloudflare version's first 8 hex chars), and confirmation `AUDIT_PAYPAL_LIVE_PREACTIVATION_READONLY`.
5. Accept results only if `PREACTIVATION_FAIL_CLOSED_AUDIT=PASS` and `WORKER_CONFIGURATION_OPERATION=GET_ONLY`. Do not treat this as proof of matching PayPal application credentials.

This manual audit has not been dispatched in the preparation PR. No GitHub Secrets, Cloudflare settings, PayPal app settings, production versions or customer orders have been changed.

## Remaining gates

- Compare the PayPal application used for OAuth to the specific Worker secret identity **without reading, copying, logging or exposing plaintext Cloudflare secrets**. Seeing secret names alone proves only their presence.
- Resolve the existing policy discrepancy: earlier authorized cap **US$250** (= `25000` minor units); current activation workflow anticipates **US$14,800** (= `1480000` minor units). The latter must not be activated as if approved under the former.
- Independently verify preproduction Sandbox behavior, governance CI and an approved rollback. Real checkout/capture requires buyer approval and the user's separate contractual gates.
- Do not use a real purchase merely to test the system. An actual customer purchase may be verified later with official PayPal and D1 evidence.

Operational status: **HOLD / PREPARE_ONLY**. This PR changes only read-only audit and governance tests.
