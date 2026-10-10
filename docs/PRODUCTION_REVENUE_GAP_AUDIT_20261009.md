# Production Revenue Gap Audit - 2026-10-09

## Decision

Jadel Tech RD is production-capable for supervised commercial intake, quote approval, PayPal-hosted payment evidence and owner-only review. It is not yet certified for fully autonomous revenue operations. Nexus and other agents may prepare briefs, evidence, recommendations and work orders, but external actions remain gated by human approval.

## Evidence observed

| Area | Current evidence | Status |
| --- | --- | --- |
| Public site | `https://jadeltechrd.com/` returned HTTP 200 during live canary. | PASS |
| Runtime health | `https://intake.jadeltechrd.com/health` returned `status=ok` and `write_mode=fail-closed`. | PASS |
| PayPal webhook boundary | Invalid webhook request returned HTTP 403 with `PAYPAL_WEBHOOK_REJECTED`. | PASS |
| Intake evidence | `Verify project intake evidence` workflow succeeded on main, run `38010236898`. | PASS |
| PayPal live readiness | Latest inspected `paypal-live-readiness.yml` main run succeeded. | PASS |
| PayPal sandbox E2E | Latest inspected `paypal-real-sandbox-e2e.yml` main run succeeded. | PASS |
| Sales-to-cash canary | Latest inspected `sales-to-cash-sandbox-canary.yml` main run succeeded. | PASS |
| Local runtime contract tests | `node --test commercial-runtime\test\*.test.mjs` passed with three bash-dependent tests skipped when host policy blocks bash. | PASS |
| Static readiness validators | Production manifest, revenue funnel, revenue control plane, sales lead intelligence and service registry validators passed. | PASS |
| Formal Codex Security preflight | Security scan preflight could not run because Python is not installed or not discoverable on this host. | BLOCKED |

## Internet-backed control baseline

- PayPal webhooks must be verified before ledger writes; PayPal documents server-side webhook delivery and signature verification using the stored webhook ID, headers and body: https://developer.paypal.com/api/rest/webhooks and https://developer.paypal.com/api/rest/webhooks/rest/
- Cloudflare D1 Time Travel provides point-in-time recovery within the last 30 days, but production readiness still requires an archived restore drill for this database: https://developers.cloudflare.com/d1/reference/time-travel/
- Cloudflare Workers secrets or Secrets Store are the correct runtime pattern for PayPal, admin and Nexus credentials; secrets must not be placed in client JavaScript, prompts, logs or documents: https://developers.cloudflare.com/workers/configuration/secrets/ and https://developers.cloudflare.com/secrets-store/integrations/workers/
- OWASP ASVS 5.x, OWASP GenAI guidance and NIST AI RMF remain the security and AI-governance baseline for 2026 production gates: https://github.com/OWASP/ASVS/releases, https://genai.owasp.org/ and https://www.nist.gov/itl/ai-risk-management-framework

## Production blockers that remain

| Priority | Blocker | Why it blocks revenue scale | Required gate |
| --- | --- | --- | --- |
| P0 | Live settlement proof | A rejected invalid webhook proves fail-closed security, not that a real approved PayPal order was captured, signed by PayPal, written to D1 and reconciled to a quote. | Run and archive a human-approved live payment capture or live pending-readonly evidence path with provider IDs redacted. |
| P0 | Owner-only approval console hardening | API protection exists, but operators need a reliable console with token handling, audit visibility, expiration and least-privilege use. | Owner-only UI smoke test, expired/invalid-token tests, audit entry evidence and rollback path. |
| P1 | D1 restore drill evidence | Backups exist at platform level, but operational readiness needs proof that this database can be restored or exported without data loss surprises. | Execute recovery drill against non-production clone and archive RPO/RTO evidence. |
| P1 | GA4 activation | Paid acquisition remains blocked because no Measurement ID and no DebugView/offline conversion proof are committed. | Add reviewed GA4 ID, CSP update, PII-negative tests and backend/offline conversion contract. |
| P1 | Sales & Lead Intelligence lawful outbound | Lead research and scoring are not enough to send messages. Consent, suppression, CRM/email sandbox receipts and legal basis are missing. | Legal matrix, suppression/deletion E2E, provider sandbox connector and human campaign approval. |
| P1 | Nexus private control-plane binding | Public site must not expose admin endpoints or VPS credentials. Nexus needs a private queue, scoped tools and durable job evidence. | Private worker/VPS binding, capability leases, job queue, idempotent work orders and HITL policy receipts. |
| P1 | Security scan runtime | The formal scan tool is blocked locally by missing Python. | Install/discover Python for Codex security tooling or run the equivalent CI security scan and archive output. |
| P2 | 30-day SLO certification | Point samples and watchdog runs are useful, but production scale needs a rolling SLO window and error-budget decision. | Complete 30-day certifier with alert delivery evidence and human acceptance. |
| P2 | Supply-chain provenance | CI validates many contracts, but release artifact provenance and SBOM/signature evidence should be linked to promotion. | Generate SBOM/provenance artifacts and attach to deployment evidence. |
| P2 | Cost-to-revenue ledger | Revenue cannot be optimized without provider fees, AI cost, support time and acquisition cost tied to settled payments. | Add cost ledger and dashboard: gross revenue, fees, AI/API cost, support cost, CAC, payback. |

## Minimal implementation order

1. Run live PayPal evidence in a human-approved path: quote -> order/pending or capture -> signed webhook -> D1 ledger -> approval receipt.
2. Harden the approval console: owner-only access, token expiry behavior, audit view and reconciliation actions.
3. Execute D1 recovery drill on a clone and retain RPO/RTO output.
4. Activate GA4 with privacy tests before any paid traffic.
5. Certify Sales & Lead Intelligence only after consent/suppression, sandbox connector receipts and quant lift evidence.
6. Bind Nexus privately through queue/work orders; keep all external actions as `PREPARE_ONLY` until approved.

## Authority boundary

Allowed now: intake, quote preparation, evidence review, recommendations, dashboards, draft artifacts, payment evidence reconciliation.

Requires human approval: PayPal live activation/capture, external messages, proposal delivery, OAuth scope changes, deployments, production connector activation, customer commitments.

Blocked by default: autonomous spending, refunds, withdrawals, contract acceptance, scraping without lawful basis, spam, real trading, publication without approval and any action using secrets outside approved secret stores.
