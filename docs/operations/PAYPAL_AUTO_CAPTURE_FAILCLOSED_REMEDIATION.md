# PayPal LIVE Worker automatic-capture fail-closed remediation

Incident: 2026-10-29, GitHub Actions run 40854402768, job worker-config.

## Evidence and boundaries
- Source workflow in $`.github/workflows/deploy-commercial-runtime.yml` declares $`PAYPAL_AUTOMATIC_CAPTURE_ENABLED:"false"`.
- Cloudflare live-version audit failed with $`WORKER_LIVE_GUARD=FAIL flag=PAYPAL_AUTOMATIC_CAPTURE_ENABLED`. This does **not** establish whether the effective value is $`true`, missing, wrong type, or another value.
- The webhook update job was skipped. Do not rerun a mutation workflow until every active version is certified.
- The code defaults automatic capture to off when the flag is absent, but production policy requires **explicit** $`false`. Do not weaken this gate or allow a missing binding as PASS.

## Diagnosis (read-only)
1. Run $`Audit PayPal LIVE Worker capture flags (read-only)` on protected $`main` with the exact current SHA and confirmation $`AUDIT_PAYPAL_LIVE_WORKER_FLAGS_ONLY`.
2. Check each $`WORKER_GUARD` line in the GitHub Actions summary. The audit classifies $`ABSENT`, $`WRONG_TYPE`, $`ENABLED`, $`OTHER_VALUE`, $`DUPLICATE`, or $`PASS`. It deliberately never prints raw binding values or secret values.
3. The audit verifies deployment coverage and reads each active Cloudflare Worker version; it does not change the Worker.

## Remediation (requires verified Cloudflare access and separate approved deployment)
1. Open Cloudflare dashboard → Workers & Pages → $`jadel-commercial-runtime` → Settings → Variables and Secrets.
2. Inspect the current active versions and existing bindings **before** editing; preserve PayPal secrets, D1, routes, cron triggers, and custom domain.
3. Set these **plain text** Worker bindings, exactly: $`PAYPAL_AUTOMATIC_CAPTURE_ENABLED=false`, $`PAYPAL_AUTOMATIC_RECONCILIATION_ENABLED=false`, $`PAYPAL_AUTOMATIC_CAPTURE_MAX_MINOR=0`, $`FINANCIAL_EXECUTION_AUTHORIZED=false`.
4. Deploy the corrected binding version in Cloudflare following authorized change control. Do not activate PayPal LIVE capture or modify webhook event subscriptions as part of the repair.
5. Re-run the read-only audit on the new active deployment; require all flags PASS on every version receiving traffic and 100% accounted-for traffic.
6. If the GitHub webhook job is to be resumed, make a **new, separate** human authorization decision after a passing audit.

## Why not change keep_vars blindly?
Both deploy workflows use $`keep_vars:true` / $`--keep-vars`. Cloudflare documents that dashboard-defined plaintext variables are retained on deploy in this mode. Blindly disabling it would risk dropping other dashboard-managed plaintext bindings; never do that without full binding inventory and a rollback plan.

## Rollback and safety
- If a deployment unexpectedly changes PayPal secrets, D1 bindings or routes, halt further writes and restore the known-good version through Cloudflare version/deployment controls with human approval.
- Never print or copy API tokens, secret values, PayPal order IDs, or client secrets into GitHub issues or logs.
- A false flag prevents automatic capture in this Worker path but does not authorize any manual LIVE-capture workflow; keep manual capture governed by its separate approval controls.
