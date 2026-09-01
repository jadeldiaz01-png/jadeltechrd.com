# Control-plane SLO operating model

The purpose of SLOs is to govern promotion and operations, not to create marketing claims.

For each production-capable service define at least: availability, successful-request ratio, p50/p95/p99 latency, policy decision latency, workflow completion latency, reconciliation age, unresolved UNKNOWN count, error rate, queue/outbox age, and evidence completeness. Human-wait time is tracked separately from machine latency.

Error budgets are consumed by failed requests, policy/identity outages, excessive latency, unreconciled side effects and evidence gaps according to the service policy. Exhausted error budget blocks feature promotion and increases operational focus until the budget recovers.

Alerts should be symptom-based and actionable. Every page-worthy alert must link to a runbook containing detection, impact, safe diagnostics, rollback/degradation, reconciliation and evidence-preservation procedures.

Cloudflare Workers Logs/metrics are used for edge diagnostics. High-cardinality aggregate product/service metrics may use Analytics Engine. Exact accounting, payment state and financial reconciliation remain in durable transactional storage, not rate-limit counters or analytics datasets.

OpenTelemetry is the cross-service correlation layer. Trace and span identifiers should propagate through API, workflow, OPA decision and evidence events without embedding raw PII in telemetry attributes. The Collector gateway provides controlled export, filtering, sampling and backend isolation.

No agent or platform is promoted because an SLO definition exists; promotion requires measured evidence over the required observation window.