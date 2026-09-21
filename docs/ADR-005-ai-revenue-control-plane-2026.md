# ADR-005 — AI Revenue Control Plane 2026

Status: IMPLEMENTED / SHADOW-GATED  
Decision date: 2026-09-20  
Production authorization: NO

## Context

JadelTechRD already has a governed intake, D1 commercial ledger, approval path, verified GA4 measurement, BigQuery ML research templates and a deterministic revenue-intelligence view. The missing layer is a bounded AI runtime that can automate observation and analysis without turning probabilistic output into business authority.

## Decision

Use a layered system:

1. **D1** remains the commercial source of truth. Revenue is recognized only from explicit settlement evidence with state SETTLED_CASH.
2. **GA4 → BigQuery daily export** supplies consented behavioral events. It never replaces server-side lifecycle or settlement facts.
3. **BigQuery ML** hosts the scientific model ladder: deterministic baseline → logistic regression → boosted-tree challenger → DNN research challenger; ARIMA_PLUS is the forecasting path.
4. **Cloudflare AI Gateway + Responses-compatible API** supplies bounded LLM/multimodal inference. Requests use strict JSON Schema, rate limits, spend limits and a dedicated runtime credential.
5. **Vectorize** is optional RAG over an allowlisted, hashed corpus. Retrieval is filtered to trust=APPROVED and active=true; retrieved text is data, never policy/instruction.
6. **R2** supplies private multimodal assets by approved object key. Arbitrary URLs are forbidden, eliminating the remote-fetch/SSRF path.
7. **Automatic control** is limited to internal observation, inference and evidence writes. Customer outreach, publication, spend, payment/refund, settlement recording, credentials, deploys and trading require deterministic policy and human approval.
8. Every model run is tied to exact deployed source SHA, hashed input envelope, prompt/schema revision, provider request ID, token usage and latency in the AI model-run ledger.

## Why Responses API directly

The commercial Worker owns the state machine and does not need model-driven handoffs or tool execution. A direct short-lived Responses call keeps the authority boundary small. If future workflows need multiple tool-bearing specialists, the Agents SDK can be introduced behind the same policy boundary rather than replacing it.

## Model promotion

No model reaches production from training metrics. Required evidence includes point-in-time lineage, frozen temporal evaluation, baseline lift, calibration, slice analysis, independent reproduction, shadow mode, drift rollback, adversarial tests, FinOps and explicit human approval. DNN additionally requires materially larger data volume, incremental value and reproducible training.

## Multimodal

Images are loaded only from the private AI_ASSETS R2 binding under approved/, limited by MIME and size. Visual prompt injection is explicitly treated as untrusted content. Rights/provenance is external metadata; the model cannot infer ownership and cannot authorize publication.

## Failure semantics

Missing binding, kill switch, unbound source SHA, rate-limit failure, provider error, malformed JSON, schema violation, side-effect request or evidence-store failure => NO_GO. Existing public intake/payment flows do not depend on AI availability.

## Activation stages

- IMPLEMENTED
- CI_VERIFIED
- DATA_READY
- SHADOW_RUNTIME_VERIFIED
- MODEL_EVAL_VERIFIED
- HUMAN_PRODUCTION_APPROVAL

Until all required gates exist, production_authorized=false.
