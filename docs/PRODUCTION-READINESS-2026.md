# Jadel Tech RD — Production Readiness 2026

This document defines the evidence-driven release standard for `jadeltechrd.com`. It does not grant production authority by itself. The authoritative machine-readable decision is `config/site-production-readiness-2026.json` and remains fail-closed until every mandatory live gate is PASS.

## Current release decision

- Baseline SHA: `1033a65c0c2d1c3cdf7c32a52c3b81d55792b70c`
- `production_authorized=false`
- `GITHUB_PAGES_CNAME=FAIL` from authenticated GitHub Pages API evidence: `cname=null`
- TLS, direct-origin, public fingerprint, governed intake and Android 11/11 remain blocked downstream.

No skipped or blocked gate is equivalent to PASS.

## 2026 control baseline

### Application security

Use OWASP ASVS 5.0.0 as the verification catalog and OWASP Top 10:2025 as the risk-awareness baseline. The 2025 Top 10 explicitly includes software supply-chain failures, security misconfiguration, integrity failures, logging/alerting failures and mishandling of exceptional conditions.

### Secure software development

Use NIST SP 800-218 SSDF 1.1 as the secure-development lifecycle baseline. Security controls belong in planning, implementation, verification, release and operations, not only in a final scan.

### Software supply chain

Target SLSA 1.2 concepts for provenance and build integrity. Use GitHub artifact attestations for public release artifacts where appropriate, generate SBOMs, and verify attestations before promotion. An attestation is evidence of provenance, not proof that the artifact is secure.

### Repository security

Use protected `main`, pull requests, required checks, least-privilege workflow permissions, commit-SHA-pinned Actions, dependency review, secret scanning/push protection and CodeQL or an equivalent SAST gate. Critical bypasses require explicit review and evidence.

### Edge, domain and transport

GitHub Pages remains the frontend origin/deployment authority. Cloudflare remains DNS/proxy/security. Do not introduce a second frontend authority for the same hostname without an architectural decision record and migration plan.

The domain release chain is:

`DOMAIN_OWNERSHIP_VERIFIED → GITHUB_PAGES_CNAME → TLS_CERTIFICATE → DIRECT_ORIGIN_4_OF_4 → PUBLIC_CURRENT_FINGERPRINT → GOVERNED_INTAKE_LIVE_CONTRACT → ANDROID_11_OF_11 → PRODUCTION_DOMAIN_GATE`

### Governed intake

Cloudflare Turnstile must be validated server-side with Siteverify. Tokens are single use and expire after five minutes. Validate hostname/action, enforce body limits, use idempotency, keep secrets server-side, and persist project/evidence/outbox state transactionally enough to support reconciliation.

### Data and recovery

Classify PII, minimize collection, define retention, encrypt in transit, use least privilege and maintain lineage. D1 state requires point-in-time recovery capability appropriate to the plan plus periodic restore testing. Outbox/reconciliation state must have bounded lag and explicit alerting.

### Reliability and SRE

Minimum SLIs: homepage availability, intake availability, valid-request success rate, p95 intake latency, 5xx rate, Turnstile failure rate, D1 write failure rate and reconciliation lag. Initial targets live in the production manifest and must be revisited after enough real traffic exists.

### AI and agentic safety

A probabilistic model output may not authorize a critical action by itself. Treat retrieved content as untrusted, separate instructions from data, enforce least-privilege tool access, apply deterministic policy before side effects, and require human approval for production, credentials, publication, financial or destructive actions.

### QA and adversarial evaluation

Production promotion requires unit, integration, contract and E2E coverage plus property/fuzz tests where parsers or external inputs exist. Add adversarial cases for prompt injection, permission escalation, secret exfiltration, replay/idempotency, stale deployments, partial failure, retries and reconciliation.

### FinOps

Track cost per correct policy-compliant result. Monitor GitHub Actions, Cloudflare, storage, egress and AI model/token consumption. Cost reduction may not remove mandatory security or evidence gates.

## Evidence model

Each production assertion should include:

- `control_id`
- `status`
- `source`
- `observed_at`
- `subject_sha_or_revision`
- `evidence_locator`

Evidence should be exact-SHA/revision-bound, timestamped, machine-verifiable where possible, reproducible/replayable where possible and free of secret material.

## Current blocking evidence

Latest authenticated Pages diagnostic returned HTTP 200 with:

- `cname=null`
- `build_type=workflow`
- `https_certificate=null`
- `https_enforced=false`

Therefore no downstream public production gate may be promoted yet.

## Primary references

- OWASP ASVS 5.0.0: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Top 10:2025: https://owasp.org/Top10/
- NIST SSDF 1.1: https://csrc.nist.gov/pubs/sp/800/218/final
- SLSA 1.2: https://slsa.dev/spec/v1.2/
- GitHub artifact attestations: https://docs.github.com/en/actions/concepts/security/artifact-attestations
- GitHub dependency review: https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review
- GitHub push protection: https://docs.github.com/en/code-security/concepts/secret-security/push-protection
- OpenTelemetry signals: https://opentelemetry.io/docs/concepts/signals/
- Cloudflare Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Cloudflare D1 limits and Time Travel: https://developers.cloudflare.com/d1/platform/limits/
