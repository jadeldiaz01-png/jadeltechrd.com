# Jadel Tech RD — P1 Commercial Runtime

## Status

Implementation scaffold integrated in `feat/agent-production-manifest-v1` and extended on 2026-08-31 with PayPal webhook ledger and authenticated approval endpoints. This increment does not enable payouts, external publication, credentials, financial actions or production promotion by itself.

## Target flow

```text
Frontend / Configurator
  -> Turnstile
  -> POST /api/v1/project-requests
  -> endpoint rate limiter
  -> strict schema + size limit + exact-origin review
  -> D1 transaction
       project_requests
       evidence_events
       dispatch_outbox
  -> scheduled outbox dispatcher
  -> Cloudflare Workflow
  -> Nexus readiness/policy service binding
  -> OPA/Rego policy decision
  -> Service Registry / Agent Adapter
  -> Quote / human approval
  -> payment provider only after approved contract
  -> verified PayPal webhook
  -> payment_ledger REQUIRES_HUMAN
  -> provisioning
  -> ACTIVE only after promotion gates
  -> reconciliation + evidence + observability
```

## Why this stack

### Cloudflare Workers
Use a small public intake Worker rather than putting privileged logic in browser JavaScript. Bindings provide capabilities without embedding account API credentials in source.

### Turnstile
The anonymous commercial intake is abuse-prone. Client-side challenge alone is insufficient, so the Worker validates every token server-side with Siteverify before durable writes.

### Workers Rate Limiting
The project-request endpoint receives a dedicated rate-limit binding. This is an abuse control, not an accounting system. Turnstile, schema validation and request-size controls remain mandatory even when rate limiting passes.

### D1
D1 is used for the first commercial control-plane slice because the workload is modest, relational and benefits from serverless scale-to-zero. `db.batch()` keeps request, evidence and outbox creation transactional. A later move to PostgreSQL remains possible behind the repository/data adapter if throughput, cross-service joins or HA requirements outgrow D1.

### Transactional outbox
The HTTP request never directly provisions a service or charges a customer. It atomically writes a `PENDING` outbox record alongside the validated request. A dispatcher subsequently starts the durable workflow. This avoids the classic failure where the database commits but the orchestration call is lost.

### Cloudflare Workflows
Workflows are the preferred P1 durable orchestrator because they persist multi-step execution, retry failed steps and can pause for external/human events. Individual steps still need idempotency.

### Queues
Queues are reserved for fan-out, telemetry and high-volume asynchronous jobs. Their at-least-once delivery means consumers must de-duplicate using stable IDs. The core project lifecycle does not depend on queue delivery for correctness.

### Observability
Workers Logs and traces are the first operational baseline. OpenTelemetry export can be enabled later for traces/logs to the selected backend. SLI/SLO evidence must exist before production promotion.

## Lifecycle contract

```text
DRAFT
  -> VALIDATED
  -> POLICY_CHECK
  -> POLICY_ALLOWED
  -> QUOTED
  -> CUSTOMER_APPROVED
  -> PAYMENT_PENDING
  -> PAID
  -> PROVISIONING
  -> ACTIVE
```

Exceptional states: `UNKNOWN`, `RECONCILING`, `FAILED_FINAL`, `CANCELLED`.

Rules:

1. Public intake can create only `VALIDATED`.
2. Nexus/readiness scoring never authorizes a critical action by itself.
3. OPA/Rego remains authoritative for policy gates.
4. Quote acceptance, paid commitment, credentials/scopes, production deployment and external publication require explicit HITL unless a future bounded delegation policy is separately approved and evidenced.
5. `ACTIVE` requires the selected service's own production-promotion evidence, not merely a successful commercial request.
6. Payment success is accepted only from a verified provider webhook and reconciled provider object; a browser redirect is never settlement evidence.

## Frontend correction required before enabling submit

The current configurator correctly starts at US$0 but the empty state can be misread as broken on mobile. The production UI should show:

- `Paso 1 de 2 · Selecciona servicios` above the empty state.
- A `Ver catálogo` control that scrolls to `#servicios`.
- `0 servicios seleccionados` changing live as cards are selected.
- A visible maturity label per selected service.
- `Copiar brief` retained as a zero-risk fallback.
- `Solicitar proyecto` added only when the Worker endpoint, production Turnstile keys and runtime bindings are deployed and healthy.
- A fail-closed message such as `Solicitudes online temporalmente no disponibles; puedes copiar el brief` whenever `/health` or required bindings are unavailable.

Do not enable a browser submit endpoint while it points to placeholders.

## Security controls already encoded

`security/api-security-manifest.json` covers Turnstile, route-specific rate limiting, strict schema validation, 16 KiB body limit, public-endpoint authorization review, CSRF model, server-only secrets, idempotency, audit/correlation IDs and fixed egress for Siteverify.

Adversarial tests cover injection, SSRF, replay/idempotency and cross-origin access control. The dedicated `commercial-runtime` GitHub Actions workflow executes these tests and validates the D1 migration.

## Payment integration decision

Use a hosted provider checkout rather than collecting card data on Jadel Tech infrastructure. Provider webhooks must be signature-verified, event IDs de-duplicated, amounts/currency checked against the accepted quote, and settlement reconciled before moving `PAYMENT_PENDING -> PAID`.

Implemented scaffold:

- `POST /api/v1/paypal/webhooks` validates PayPal signatures through PayPal's verification API.
- `payment_events` stores verified provider events by provider event ID.
- `payment_ledger` records events as `REQUIRES_HUMAN`; no automatic fulfillment follows from webhook receipt.
- `/api/v1/admin/approvals` requires `ADMIN_API_TOKEN` and records approval evidence.

## SLO draft for canary

- intake availability SLO: 99.9% over 30 days after canary stabilization
- accepted-request durability: 100% of HTTP 202 responses have matching `project_requests`, `evidence_events` and `dispatch_outbox` records
- duplicate side effects from identical idempotency key: 0
- unresolved outbox older than 10 minutes: 0 during normal operation
- p95 intake latency excluding Turnstile network time: target < 500 ms
- policy bypass incidents: 0

These are targets, not verified SLO claims until runtime measurements exist.

## Production blockers

1. Provision Cloudflare Worker deployment target.
2. Provision D1 and apply migration.
3. Create production Turnstile widget and secret.
4. Provision rate-limit namespace.
5. Implement/bind `ProjectLifecycleWorkflow`.
6. Implement Nexus policy/readiness service binding and OPA/Rego decision contract.
7. Enable frontend submit UI only after health/contract tests pass.
8. Provision PayPal webhook credentials and set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.
9. Set `ADMIN_API_TOKEN` and deploy an operator-only approval client.
10. Configure alerting, SLO dashboards and runbooks.
11. Execute canary and collect evidence before any `PRODUCTION_VERIFIED` claim.
