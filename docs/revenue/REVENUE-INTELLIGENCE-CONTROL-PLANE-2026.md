# Revenue Intelligence Control Plane 2026 — Jadel Tech RD

**Status:** IMPLEMENTATION_CANDIDATE · fail-closed · production authorization remains false.

## Objective

This layer turns the website's existing acquisition, intake, approval and payment evidence into a governed decision system. It is deliberately split into deterministic facts, statistical/ML evidence, LLM/multimodal advisory analysis and an authorization boundary.

The control loop is:

```
GitHub Pages + Cloudflare edge
  -> consent-gated GA4 behavior telemetry
  -> Cloudflare Worker governed intake
  -> D1 commercial ledger (authoritative commercial facts)
  -> GA4 BigQuery daily export (pending external product-link evidence)
  -> privacy-reviewed feature views
  -> deterministic KPI engine / BigQuery ML / forecasting
  -> LLM + multimodal advisory layer
  -> deterministic policy
  -> human approval for critical external actions
```

No model is allowed to spend advertising money, publish externally, contact a customer, execute/refund a payment, change credentials, allocate trading capital, or promote production state by itself.

## What is implemented in this change

- Machine-readable control-plane manifest.
- Machine-readable model registry.
- Deterministic recommendation engine with bounded model signals.
- Aggregate-only authenticated runtime endpoint: `GET /api/v1/admin/revenue-intelligence`.
- D1 schema for lead lifecycle evidence, internal snapshots and proposals.
- BigQuery aggregate feature, logistic-regression, boosted-tree, ARIMA_PLUS and research-only DNN templates.
- CI validation and evidence artifact.
- Adversarial tests proving anonymous access/write attempts fail closed and the engine never grants external authority.

## Data architecture

### Source-of-truth rules

1. **D1 commercial ledger** owns governed project, policy, lifecycle and reconciled payment facts.
2. **GA4** owns behavioral analytics only; it never certifies a customer, payment or revenue settlement.
3. **BigQuery daily export** becomes the reproducible analytical layer only after the GA4 product link and first `events_YYYYMMDD` table are independently observed.
4. Direct identifiers, free-text notes, auth material, payment credentials and Turnstile tokens are prohibited ML features.

Every derived dataset must retain source, event time, ingestion time, schema version, transformation revision and quality state.

## ML / deep learning

The initial statistical ladder is intentionally simple-first:

- deterministic rules/KPIs;
- logistic regression as interpretable propensity baseline;
- boosted-tree classifier as nonlinear challenger;
- DNN classifier only as a research candidate when labeled sample size and incremental value justify it;
- ARIMA_PLUS for reconciled revenue forecasting;
- TimesFM only as an evaluation candidate while provider maturity/fit is assessed.

No fabricated accuracy/AUC/ROI threshold is encoded as evidence. Promotion requires frozen temporal holdout or walk-forward evaluation, leakage tests, baseline comparison, calibration where relevant, segment/regime analysis, robustness, cost/latency measurements and rollback.

## LLM / agentic layer

The target LLM role is **advisory**: explain aggregate evidence, identify anomalies, summarize funnel friction and draft internal action plans. The intended API pattern is server-side Responses/Agents with structured outputs, an explicit tool allowlist, bounded recursion/token/cost budgets, tracing and adversarial evaluation.

External text, web content and retrieved documents are untrusted data, never instructions. Prompt injection, tool poisoning, memory poisoning, excessive agency, sensitive-information disclosure and unbounded consumption are mandatory evaluation classes.

The LLM path remains **not activated** until server-side credentials, gateway spend/rate limits, structured output validation and eval evidence exist.

## Multimodal layer

Multimodal analysis is reserved for creative QC and trend/brand analysis. It may score or flag assets, but publication remains human-gated. Required evidence includes rights/provenance metadata, content-safety evaluation, visual prompt-injection tests and takedown/rollback capability.

## FinOps

Unit economics are measured per correct governed outcome rather than per request. Required dimensions include model tokens, third-party calls, storage, egress, observability, database work and human-review time.

Cloudflare AI Gateway is a candidate control point for LLM spend limits, rate limiting, logging, fallback and provider routing. Enabling it is a separate environment/configuration action; this source change does not claim that live gateway evidence exists.

## Security and supply chain

This design aligns with the repository's existing fail-closed governance and adds no browser secrets. CI keeps third-party GitHub Actions pinned to immutable commit SHAs. Production promotion continues to require verified SBOM/provenance/attestation controls from the institutional release path.

## Evidence still required before production authorization

- GA4 -> BigQuery product link and first daily export table observed.
- Enough governed lifecycle labels to train/evaluate any propensity model.
- Exact-revision offline evaluation and frozen holdout evidence.
- Shadow-mode observations with no external side effects.
- Drift, rollback, latency and cost evidence.
- LLM/multimodal adversarial evals if those paths are enabled.
- Current institutional domain gates and explicit human production approval.

Implementation is not evidence. An unavailable, skipped, stale or inferred control does not become PASS.

## Primary 2026 references

- NIST AI RMF and Generative AI Profile: https://www.nist.gov/itl/ai-risk-management-framework
- OWASP GenAI/LLM risks: https://genai.owasp.org/llm-top-10/
- OWASP Top 10: https://owasp.org/Top10/
- OpenAI Agents API: https://openai.com/index/introducing-the-agents-api/
- OpenAI Evals: https://platform.openai.com/docs/guides/evals
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/specs/semconv/
- SLSA v1.2: https://slsa.dev/spec/v1.2/
- GitHub artifact attestations: https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/
- BigQuery ML: https://cloud.google.com/bigquery/docs/bqml-introduction
- Cloudflare AI Gateway: https://developers.cloudflare.com/ai-gateway/
