# Jadel Tech RD — Nexus Production Operating Model 2026

## Purpose

Use AegisQuant Nexus as a production-readiness coordinator across Jadel Tech services without allowing it to bypass domain-specific controls. Nexus evaluates evidence, assigns maturity, opens remediation work, and emits only promotion recommendations. It never enables live trading, external publication, paid commitments, credential changes, or destructive actions by itself.

## Target architecture

```text
Jadel Tech public site
  -> Readiness Registry / Service Catalog
  -> Lead intake (future Cloudflare Worker, Turnstile, rate limits)
  -> Control Plane API
      -> Nexus Readiness Coordinator
      -> Policy Decision Point (OPA/Rego)
      -> Approval Engine (HITL)
      -> Agent Registry / Adapter Registry / Model Registry
      -> Durable Workflow Engine
      -> Evidence Ledger
      -> Reconciliation
      -> FinOps Budget Guard
      -> OpenTelemetry
      -> OpenBao workload identity / secrets
      -> PostgreSQL durable state
```

## Nexus responsibilities

Nexus is a deterministic readiness coordinator with specialist tools. It must:

1. ingest repository evidence, workflow conclusions, signed artifacts, runtime checks, SLO evidence and approval records;
2. classify every service as RESEARCH, PILOT, DEGRADED, IMPLEMENTABLE, CANARY or PRODUCTION_VERIFIED;
3. fail closed when evidence is missing, stale or contradictory;
4. route remediation to Security, SRE, QA, Data, FinOps, Media, Revenue or Quant specialists;
5. calculate a readiness score only as a prioritization signal, never as authorization;
6. produce a signed promotion dossier containing source SHAs, test runs, blockers, residual risks and required human approvals.

## Common production gates

Every production service must demonstrate:

- owner, scope and data classification;
- threat model and abuse cases;
- OPA/Rego policy tests;
- workload identity and least privilege;
- secrets externalized to OpenBao or equivalent approved secret manager;
- pinned dependencies and GitHub Actions;
- SBOM, provenance and artifact signing;
- unit, integration, contract, E2E and adversarial tests;
- idempotency for side effects;
- reconciliation for indeterminate external outcomes;
- OpenTelemetry traces, metrics and logs;
- SLI/SLO, alerting, error budget and runbook;
- backup/restore evidence for stateful components;
- capacity, quotas and FinOps budget;
- canary evidence and rollback path;
- tested HITL points for sensitive actions.

## Service completion tracks

### CineForge / Reels Meta

Required completion: verified render provider, real MP4 E2E, ffprobe and loudness QC, subtitle and continuity checks, persistent evidence ledger, persistent quotas, platform reconciliation, OpenBao secrets, signed releases, SLOs and supervised publish canary. External publication remains HITL.

### Social Trend Intelligence

Required completion: official/authorized data-source coverage, normalized metric contracts, freshness and confidence calibration, false-positive evaluation dataset, rights/TOS registry, scheduled collection observability, provenance and trend-breakout evaluation.

### Meta/Facebook Integration

Production is per customer deployment. Required completion: customer OAuth credentials, approved scopes, app live/review evidence where required, token rotation, webhook validation if used, contract tests, rate limits, audit records and supervised publish test.

### Support & Tickets

Required completion: customer identity model, RBAC/ABAC, tenant isolation, retention policy, escalation and fallback tests, prompt-injection defenses for retrieved content, SLOs, audit/export controls and backup/restore when stateful.

### Revenue Opportunity Intelligence / AUREUS

Required completion: authorized marketplace adapters only, TOS/GEO policy evidence, durable ExternalActionIntent, idempotent submission, UNKNOWN + reconciliation, settlement reconciliation, attributable costs, evidence ledger and profitability reporting based only on reconciled cash. Proposal submission, contract acceptance and paid commitments remain HITL unless an explicit bounded delegation policy is approved.

### Institutional Trading Bot / AegisQuant Nexus

Remain separated from commercial automation. Required completion follows RESEARCH -> PAPER -> TESTNET -> TESTNET_EVIDENCE_COMPLETE -> LIVE_PILOT_HUMAN_REVIEW. No production/live-capital activation follows from a model or readiness score. Quant gates include reproducibility, point-in-time data, costs/slippage/latency, forward evidence, reconciliation, risk fail-closed, kill switches and human capital authorization.

## Revenue strategy

Sustainable revenue should come first from services that can be safely productized without speculative autonomy:

1. Agentic architecture and production-readiness assessments.
2. Meta/Facebook integration and app-review engineering.
3. Support/ticket agent implementations.
4. Social intelligence and supervised content-production retainers.
5. CineForge production packages after E2E media evidence is complete.
6. Revenue-opportunity workflow engineering after marketplace adapters and settlement reconciliation are proven.
7. Quant research/risk engineering as a research service, not a promise of trading profits.

Recurring revenue should be attached to measurable operating work: monitoring, updates, model/API usage, observability, support, content cadence, integration maintenance and SLO-backed managed operation. Never represent projected income as guaranteed income.

## Human approval boundary

Mandatory human approval remains required for production deployment, new credentials/scopes, public publishing, paid third-party commitments, contract acceptance, destructive changes, live-market promotion and capital allocation.
