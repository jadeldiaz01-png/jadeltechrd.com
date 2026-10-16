# Production Readiness Work Order

**Status:** PREPARE_ONLY  
**Baseline:** `main` at `967e99a242b18fe2d2cefc14a15f9d6527ebd1ae` (verified 2026-10-16)  
**Scope:** evidence preparation, offline tests, and controlled synthetic tests only. This work order does not authorize production deployment, live payment mutation, customer-data processing, or external communication.

## Objective

Close the five production-readiness gates below with reproducible evidence tied to an exact source SHA. Until every applicable gate passes, describe the site as a supervised catalog/intake experience, not as a fully operational autonomous revenue platform.

## Ordered gates

### G0 — Public maturity claims (P0)

- Compare every payment, ledger, control-plane, readiness, and autonomy claim on the public homepage with runtime evidence.
- Keep payment webhook, ledger, and reconciliation explicitly pending until a successful end-to-end proof exists.
- Add a regression test to both the static fallback and interactive homepage surfaces.

**Acceptance:** no unverified payment-ledger claim is labeled `PASS` or `READY`; the copy test passes for both surfaces; copy accurately distinguishes implemented, pilot, and pending capabilities.

### G1 — Synthetic intake (P0; isolated environment only)

Test valid synthetic submission, missing/invalid Turnstile, invalid payload, timeout, duplicate idempotency key, and persistence failure. Do not submit a real customer request.

**Acceptance:** every negative case fails closed and creates no request; duplicate replay creates at most one record; no PII is emitted to logs or analytics; evidence records test case, outcome, UTC timestamp, environment, and source SHA. If isolated staging/test storage is unavailable, mark BLOCKED instead of using production intake.

### G2 — PayPal LIVE settlement and reconciliation (P0; exact-order human gate)

Prepare a runbook first. Execute only against one exact client-approved order after confirming the approved `quote_id`, `payment_order_id`, and `paypal_order_id`. Verify the provider signature before ledger mutation, idempotency on redelivery, D1 ledger linkage, reconciliation result, and audit receipt. No automatic capture, refund, payout, or withdrawal.

**Acceptance:** one specifically authorized order yields one reconciled ledger event and one auditable receipt; invalid signature is rejected; replay does not duplicate the event. Record provider IDs only in the approved secure evidence store, never in public artifacts.

### G3 — Owner console and D1 recovery (P0; non-production copy)

Test anonymous, wrong-role, expired/revoked, and authorized-owner access. Verify read/approve separation, expiry, and immutable audit history. Perform restore/export recovery only on a clone; agree RPO/RTO before the drill and record measured values.

**Acceptance:** unauthorized cases are denied; replay cannot execute approval twice; restored data passes integrity checks and meets the pre-agreed RPO/RTO. No secret values are copied into evidence.

### G4 — Analytics, SLO, and supply-chain provenance (P1)

- GA4: verify the configured measurement ID in the GA interface and receive an allowlisted synthetic event in DebugView. With consent denied, outbound analytics requests must be zero. Verify no PII in event payloads.
- SLO: use the repository's approved SLI/SLO policy and certifier. Gather a complete 30-day window; do not backfill missing observations or change thresholds to force a pass.
- Release: retain SBOM, attestations, artifact hashes, source repository, and the exact deployed SHA. Confirm the SHA served by Pages equals the artifact source SHA.

**Acceptance:** evidence is reproducible; the configured SLO window certifies PASS under the existing policy; consent-denied analytics sends zero events; the deployed and attested source SHA match exactly.

## Evidence record

For each gate retain: gate ID, UTC timestamp, environment, test/tool version, source SHA, result, artifact URI/hash, operator, approver (where required), and limitations. Redact personal and payment data from reports.

## Stop conditions

Stop and mark BLOCKED on missing staging isolation, missing exact-order approval, unverified webhook configuration, owner authorization failure, unknown RPO/RTO, failed/absent checks, any PII/secret leakage, incomplete SLO coverage, or SHA/provenance mismatch. Do not bypass a gate.

## Completion decision

`PRODUCTION_READY` is allowed only when G0-G4 pass with evidence and all required human approvals are recorded. A merged PR, green CI, sandbox test, or successful homepage response alone is not production certification.
