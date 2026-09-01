# Platform certification gates

A platform may progress only when evidence for the target environment is current and attributable. Repository presence, adapter code, UI availability, a configured credential, or a successful synthetic request is not sufficient by itself.

## States

- `unverified`: no current trustworthy runtime evidence.
- `research_only`: discovery or offline analysis only; no external side effects.
- `sandbox_ready`: sandbox/test credentials and contract tests exist.
- `integration_ready`: adapter and required controls exist, but production/customer/platform evidence remains incomplete.
- `verified_runtime`: production-scoped identity, permissions, contract E2E, idempotency, audit evidence, reconciliation, SLO/health and required human approval have all been demonstrated.
- `blocked`: a policy, terms, geography, identity, safety or technical blocker prevents promotion.

## Mandatory external-side-effect gates

Every external side effect requires all of: AUTHORIZED, POLICY_ALLOWED, TOS_ALLOWED, GEO_ALLOWED, RISK_ALLOWED, IDENTITY_ALLOWED, AUDITABLE, IDEMPOTENT and RECONCILABLE. Critical actions additionally require explicit human approval. OPA remains deny-by-default.

## Minimum certification evidence

For each platform, capture platform/API version, account/app identity, environment, granted scopes, credential provenance without exposing the credential, official terms/policy review date, geo eligibility, rate-limit policy, idempotency behavior, failure/retry behavior, reconciliation proof, remote object/transaction identifier when applicable, audit trace/decision IDs, SLI/SLO results, incident/rollback path, and the human approver for critical production activation.

## Current interpretation

`integration_ready` is not production certification. In particular, it cannot authorize publication, payment, contract acceptance, credential changes, production deployment, live market actions or destructive operations. Those actions require `verified_runtime` plus the applicable human gate.