# Jadel Tech Control Plane Registry — P1

## Objective

Turn the public commercial site into the governed front door of the Jadel agent control plane without presenting repository presence or partial integrations as production readiness.

## Canonical sources

- Agent Registry: `config/agent-production-manifest.json`.
- Platform Registry: `config/platform-registry.json`.
- Registry index and institutional gates: `config/control-plane-registry.json`.
- SLO and telemetry privacy: `config/slo-policy.json`.
- Policy authority contract: `policy/rego/control_plane.rego`.
- OpenBao workload identity contract: `infra/openbao/workload-identities.json`.

The existing agent production manifest remains the canonical agent registry. This avoids creating a second agent catalog that could drift from maturity and blocker evidence.

## Runtime flow

`jadeltechrd.com -> governed intake -> Turnstile -> rate limit -> validation -> idempotency -> D1 request/evidence/outbox -> durable workflow -> policy decision -> human approval when required -> platform adapter -> reconciliation`

Every external side effect must be associated with an intent, policy decision, evidence correlation identifier and reconciliation path. An unavailable policy, identity, evidence store or reconciliation capability fails closed.

## Policy authority

OPA/Rego is the target deterministic policy authority. `control_plane.rego` defaults to deny and requires all institutional gates. Critical actions also require a human approval bit and an eligible platform state. The policy is tested in CI using a SHA-verified OPA release binary.

For production OPA deployment, policies should be distributed as signed bundles and decision logs should export `decision_id`/trace context to the evidence and observability plane. The repository policy is the source contract, not evidence that an OPA service is already deployed.

## OpenBao identity architecture

OpenBao is the target secrets authority. The repository defines seven least-privilege workload identities: control, research, execution, migration, backup, observability and CI. Static root tokens are forbidden. Production promotion requires TLS, audit logging, a configured workload auth method, short-lived credentials and evidence that no static `OPENBAO_TOKEN` is used by CI/runtime.

This change does **not** claim a live OpenBao cluster. Deployment and workload-login evidence remain an explicit gate.

## Observability and SLOs

Cloudflare Workers native observability remains the immediate edge source for request/error/latency signals. Structured application events must not contain name, email, notes, auth headers, Turnstile tokens or provider secrets. Correlation/project/workflow/policy decision identifiers are permitted.

The target long-term topology is Worker/native telemetry + host/service OpenTelemetry collectors -> OTel gateway -> approved telemetry backends. Critical business evidence remains in the Evidence Ledger rather than relying on best-effort operational logs.

Initial objectives are intentionally measurable and reviewable, not contractual SLAs:

- public site successful HTTPS load ratio >= 99.9%;
- durable intake acceptance >= 99.95% excluding client/Turnstile rejection;
- p95 server acceptance < 1.5 s excluding human challenge;
- outbox resolution >= 99.99% with p95 pending-to-dispatched < 120 s;
- policy decision availability >= 99.9%, while policy unavailability always denies.

## Platform certification

No platform inherits production status from another platform. Each platform progresses independently through evidence:

`UNVERIFIED -> RESEARCH/PILOT -> SANDBOX/TEST -> EVIDENCE_COMPLETE -> HUMAN_REVIEW -> PRODUCTION_CANARY -> PRODUCTION_VERIFIED`

Current registry semantics:

- Cloudflare commercial runtime: live runtime evidence exists, but real human intake, alerting and recovery evidence are still required.
- PayPal: payment/webhook/ledger implementation exists; live reconciled project-payment evidence remains required.
- Meta/Facebook: implementable integration; live app/scopes/token/publish/reconciliation evidence is deployment-specific.
- YouTube, TikTok and X: blocked until official adapters and platform-specific tests exist.
- GitHub: engineering runtime is in active use with protected delivery; complete SBOM/provenance/attestation remains a supply-chain follow-up.

## Release gate

The control-plane registry CI must pass before merge. It validates unique identities, maturity/status enums, required institutional gates, SLO ranges, telemetry PII prohibition, OpenBao workload identity drift, obvious secret patterns and Rego formatting/tests.

A green registry gate is a configuration/policy correctness signal. It does not by itself certify any platform as production ready.
