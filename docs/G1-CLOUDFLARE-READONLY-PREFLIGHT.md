# G1 — Cloudflare identity reconciliation (PREPARE-ONLY)

## Authorization boundary

This proposed change prepares a protected read-only discovery workflow. It **does not certify G1**.
No deployment, secret changes, D1 SQL, HTTP POST, synthetic intake requests, merge, or workflow dispatch are authorized by this PR.
Do not merge or manually execute without separate exact-SHA approval and independent review.

- Base: `main` at `53067e8566bc2662a17f1d530d58ede740c605f4` (recheck at review).
- GitHub Environment (user-configured, values not retrievable here): `g1-cloudflare-readonly`.
- Environment secret: `CLOUDFLARE_G1_READ_TOKEN`.
- Environment variable: `CLOUDFLARE_ACCOUNT_ID`.
- Required declared Cloudflare scopes: **Workers Scripts Read** and **D1 Read**, account-scoped, **no Write/Edit**.
- Reviewer: `flotaopd-del` (independent GitHub approval must bind to the PR HEAD at review time).
- Production Worker/D1 name: `jadel-commercial-runtime`.
- D1 recovery drill is **not** staging: `jadel-commercial-runtime-recovery-drill`.

## Behavior

The script performs only these authenticated HTTPS `GET` requests:

- Account token verify: `/accounts/{account}/tokens/verify`.
- List Workers: `/accounts/{account}/workers/scripts`.
- List D1 databases (paginated): `/accounts/{account}/d1/database`.
- Get Worker script-and-version settings: `/accounts/{account}/workers/scripts/{worker}/settings`.
- Get staging D1 detail: `/accounts/{account}/d1/database/{uuid}`.
- List staging Worker deployments: `/accounts/{account}/workers/scripts/{worker}/deployments`.

Fail closed if the Worker is not uniquely identifiable, `DB` binding is absent/ambiguous, production identity does not match, staging D1 reuses production or recovery, or a required GET is denied. An isolated Worker with a separate D1 can receive **INVENTORY_ISOLATION_PASS_NOT_G1_CERTIFICATION**; this is **not** a complete security or G1 PASS.

The script outputs only fingerprints for D1 UUIDs and the account ID; not raw token, raw UUIDs, API bodies, customer data, or secret values. Exact staging Worker and D1 names may appear, as required for the inventory record. GitHub's workflow is manual-only, on protected `main`, `permissions: contents: read`, using the protected Environment, and checks `git rev-parse HEAD == GITHUB_SHA`.

## Local verification without Cloudflare access

```bash
python3 -m unittest discover -s scripts/g1 -p 'test_cloudflare_readonly_inventory.py' -v
python3 -m py_compile scripts/g1/cloudflare_readonly_inventory.py
```

## What this does **not** prove

1. GitHub's protected Environment secret exists and works, until a real run completes.
2. The token **lacks** write permission — the GET responses prove usable read access, **not** that write scopes are absent. Confirm the token policy in Cloudflare; never probe with POST/PUT/PATCH/DELETE.
3. The deployed staging Worker matches the workflow source SHA: Cloudflare metadata is not a source-SHA attestation.
4. A public staging URL exists: inventory listing and bindings do not alone establish one.
5. The G1 synthetic battery (valid/invalid Turnstile, malformed payload, timeout, duplicate idempotency, persistence failure) passed; PII and zero-production-writes controls passed; or `flotaopd-del` approved this HEAD.
6. Real staging may be a Preview version rather than a separate named Worker. If so, this strict script will block instead of making up a resource.

## Manual execution gate — separate future authorization required

After independently approving and merging a precisely scoped PR, reconfirm `main` SHA, protection, Environment reviewers, and token's **read-only** Cloudflare policy. Then use GitHub Actions → `G1 Cloudflare inventory (GET only)` → Run workflow, with empty inputs for unique discovery or exact existing names. No run should be triggered before that gate.

A successful inventory run can be reconciled with independently attested G1 test evidence and an independent `APPROVED` review tied to the relevant source and deployed SHAs. Until then: `G1=PENDING_EVIDENCE`, `PRODUCTION_AUTHORIZED=false`.

Docs:
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/list/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/script_and_version_settings/methods/get/
- https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/list/
