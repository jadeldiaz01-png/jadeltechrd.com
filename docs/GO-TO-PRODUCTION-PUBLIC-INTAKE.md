# Governed Public Intake — Production Gate

This document defines the production contract for the public **Solicitar proyecto** surface.

## User-facing contract

- The configurator CTA must route to `/solicitar-proyecto.html?services=...`.
- The governed CTA must never use `mailto:` as its primary execution path.
- The public form remains fail-closed until Cloudflare Turnstile is initialized.
- Submitting a request never authorizes payment, contract acceptance, publication, credentials use, production changes, or financial operations.

## Edge/runtime contract

- API origin: `https://intake.jadeltechrd.com` on a Cloudflare Worker custom domain.
- Exact allowed browser origin: `https://jadeltechrd.com`.
- `GET /health` must report `write_mode=fail-closed`.
- `GET /api/v1/public-config` exposes only the public Turnstile sitekey/action and must never expose secrets.
- `POST /api/v1/project-requests` requires valid JSON, strict schema, idempotency key, rate limiter, Turnstile Siteverify, D1 and evidence/outbox bindings.
- Turnstile validation must enforce `success=true`, exact hostname and exact action.
- D1 persists the request, evidence event and transactional outbox before workflow dispatch.

## Replay and consistency contract

- Same idempotency key + same request fingerprint: return the existing project, never duplicate.
- Same idempotency key + different fingerprint: fail with HTTP 409.
- D1 is the authoritative durable record for intake state.
- Rate Limiting is an abuse-control layer, not an accounting or exactly-once mechanism.
- Transactional outbox + reconciliation protect workflow dispatch against crash/timeout ambiguity.

## Verification gates

Before declaring `PUBLIC_INTAKE_VERIFIED`, all of these must pass:

1. Public site and governed intake assets reachable over verified HTTPS.
2. Browser CTA routes to governed intake and no governed bridge path contains `mailto:`.
3. Cloudflare Worker health is green and fail-closed.
4. CORS accepts only `https://jadeltechrd.com`.
5. Turnstile public config is origin-bound and secret-free.
6. OPTIONS preflight allows only `content-type,idempotency-key` for the production origin.
7. Human completes one real Turnstile challenge and submits one real test request.
8. Returned `project_id` is reconciled in D1.
9. Evidence Ledger contains `PROJECT_REQUEST_ACCEPTED`.
10. Outbox cardinality is exactly one and resolves to `PENDING` or `DISPATCHED` according to timing.
11. Workflow/policy state remains fail-closed when a required policy or human gate is unavailable.
12. No automatic payment or external side effect occurs.

## Cache/deployment resilience

Because GitHub Pages and browsers can keep an already-open document in memory, a user may still see an older CTA after a deployment. Operational guidance:

- A production deploy is not considered user-visible until the live contract workflow passes.
- Existing browser tabs should be hard-refreshed when validating a newly deployed static release.
- Future static-asset revisions should move toward content-hashed/versioned asset URLs so a new HTML release cannot silently pair with stale JavaScript.
- Live smoke tests must verify the governed intake assets, API CORS/Turnstile contract and CTA implementation, not only generic homepage text.

## SRE/observability follow-up

Recommended next increment:

- Analytics Engine metrics for accepted requests, 403 Turnstile, 403 Origin, 409 replay conflicts, 429 rate limiting, 5xx writes and outbox reconciliation latency.
- SLOs for intake availability and successful durable acceptance.
- Alert on sustained 5xx, outbox backlog, D1 write failures, Turnstile verification anomalies and custom-domain TLS failures.
- Retention policy and PII minimization for request/evidence records.
- Periodic restore/readiness test for D1 exports/backups where supported by the chosen recovery architecture.
