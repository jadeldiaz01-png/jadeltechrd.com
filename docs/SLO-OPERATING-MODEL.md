# Control-plane SLO operating model

The purpose of SLOs is to govern promotion and operations, not to create marketing claims.

For each production-capable service define at least: availability, successful-request ratio, p50/p95/p99 latency, policy decision latency, workflow completion latency, reconciliation age, unresolved UNKNOWN count, error rate, queue/outbox age, and evidence completeness. Human-wait time is tracked separately from machine latency.

Error budgets are consumed by failed requests, policy/identity outages, excessive latency, unreconciled side effects and evidence gaps according to the service policy. Exhausted error budget blocks feature promotion and increases operational focus until the budget recovers.

Alerts should be symptom-based and actionable. Every page-worthy alert must link to a runbook containing detection, impact, safe diagnostics, rollback/degradation, reconciliation and evidence-preservation procedures.

Cloudflare Workers Logs/metrics are used for edge diagnostics. High-cardinality aggregate product/service metrics may use Analytics Engine. Exact accounting, payment state and financial reconciliation remain in durable transactional storage, not rate-limit counters or analytics datasets.

OpenTelemetry is the cross-service correlation layer. Trace and span identifiers should propagate through API, workflow, OPA decision and evidence events without embedding raw PII in telemetry attributes. The Collector gateway provides controlled export, filtering, sampling and backend isolation.

No agent or platform is promoted because an SLO definition exists; promotion requires measured evidence over the required observation window.

## Public-domain certification chain — 2026

The public-domain SLO gate is measured independently from the full commercial-intake business SLO.

### Measurement model

The external synthetic runs every 10 minutes at minutes 7, 17, 27, 37, 47 and 57 UTC. The measured SLI is always the first attempt. Transport retries may be used only for diagnostics and may never replace a failed measured sample.

Only scheduled runs count toward certification. Manual and push-triggered smoke probes are operational diagnostics and cannot increase the coverage numerator.

Thirty complete UTC days contain 4,320 expected ten-minute slots. Certification requires at least 95% observed coverage and no blind interval longer than 30 minutes. Missing monitor observations are treated as missing evidence and never as successful service responses.

### Public-domain SLOs

- Public site availability: 99.9%.
- Commercial intake health availability: 99.5%.
- Public site p95 synthetic response latency: <= 1,500 ms.
- Commercial intake health p95 synthetic response latency: <= 1,500 ms.

The commercial-intake health SLO above is intentionally distinct from the higher valid-request acceptance objective defined for the commercial-intake domain. A health endpoint synthetic cannot certify durable request acceptance, Turnstile adjudication or outbox reconciliation.

### Error budget and burn rate

Error-budget consumption is calculated from observed eligible scheduled samples. Missing samples are handled by the independent evidence-coverage gate.

The 30-day certifier evaluates 1h, 6h and 24h burn windows using thresholds 14.4x, 6x and 3x. A window with insufficient measurement coverage is UNKNOWN and prevents certification.

A failed first-attempt availability or semantic probe creates or updates the operational GitHub Issue alert. Burn-rate alerts are evaluated independently by the certifier.

### Alert delivery proof

A weekly controlled test creates a uniquely marked GitHub Issue, reads it back, comments on it, closes it, verifies the closed state, creates machine-readable evidence, signs that evidence through GitHub/Sigstore and verifies the attestation. The test explicitly states that it is not an outage.

Alert-delivery evidence must be no older than 30 days when the certification window is adjudicated.

### Evidence pipeline

1. `.github/workflows/site-slo-evidence.yml` produces raw first-attempt samples.
2. `.github/workflows/site-slo-daily-rollup.yml` collects the completed previous UTC day and emits one compact daily artifact.
3. `.github/workflows/site-slo-certifier.yml` reconstructs the most recent 30 complete UTC days from daily artifacts.
4. `scripts/certify-site-slo.mjs` adjudicates coverage, max gap, availability, p95 latency, error budget, burn rate, semantic invariants and alert-delivery freshness.
5. The final certification JSON is attested and cryptographically verified.
6. A PASS signals readiness for human promotion review; it does not self-edit the production manifest or bypass the required human production authorization.

### Scheduler and observability assumptions

GitHub Actions scheduled jobs can be delayed or dropped under load, so scheduler gaps are part of the evidence-quality model. Scheduling deliberately avoids minute 0.

HTTP synthetic duration maps to the OpenTelemetry `http.client.request.duration` semantic convention. Artifacts retain milliseconds for operational readability while the semantic convention's canonical unit is seconds.

Cloudflare D1 analytics can complement service diagnosis with query volume, query latency and storage metrics, but those backend analytics are not substituted for the independent public synthetic used by this public-domain gate.
