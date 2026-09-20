# Jadel Tech RD — Production Readiness 2026

This document is the human-readable site-readiness view. The institutional promotion authority is now `config/institutional-production-manifest-2026.json`; the site-specific machine-readable evidence remains `config/site-production-readiness-2026.json`.

Neither document grants production authority by prose. Promotion remains fail-closed and evidence-driven.

## Current evidence snapshot — 2026-09-19

Baseline public revision: `47d72e20c2d9ae6d48ba46cb7b2795c6272928a4`.

Current verified evidence includes:

- Pages domain readiness PASS — run `35453781584`.
  - GitHub Pages workflow build PASS.
  - GitHub domain TXT verification PASS.
  - Cloudflare edge DNS PASS.
  - Public governed immutable bundle PASS.
- Governed intake live contract PASS — run `35468993129`.
  - Public intake assets and single-owner source PASS.
  - CORS/Turnstile public contract PASS.
  - Governed CTA browser E2E PASS.
  - Immutable app PASS.
  - Intake CSP/security policy PASS.
- Commercial live smoke PASS — run `35468609893`, successful rerun job `105971757480`.
  - HTTP/TLS PASS.
  - Legal discovery PASS.
  - Chrome render PASS.
- Live add-agent governed regression PASS — run `35023571934`.
  - Max-8 selection contract PASS.
  - Remaining Add controls disabled PASS.
  - Governed intake routing PASS.
  - Single-owner and immutable app PASS.
- Security baseline PASS — run `35023533970`.
  - Source security PASS.
  - Immutable GitHub Actions PASS.
  - CSP browser smoke PASS.

The live immutable frontend observed on 2026-09-19 is:

`/app.47d72e20c2d9ae6d48ba46cb7b2795c6272928a4.js`

## Topology correction

The earlier readiness model treated GitHub Pages `cname` and `https_enforced` fields as mandatory public-production signals. That is no longer correct for the deployed topology.

Current authority model:

`GitHub Actions/Pages origin -> Cloudflare DNS/edge/TLS -> public user`

The authenticated Pages audit reports `build_type=workflow`, `cname=null`, and `https_enforced=false`, while the GitHub Pages verification TXT, Cloudflare edge DNS, immutable bundle, public HTTPS/TLS, and live browser contracts pass. Therefore the legacy CNAME gate is retained only as a compatibility/diagnostic record and is not a promotion dependency.

The old `ANDROID_11_OF_11` gate is likewise obsolete because governed intake intentionally caps one request at 8 services. It is replaced by `ANDROID_GOVERNED_MAX_8`.

## Remaining site blockers

Full site promotion is intentionally still closed until both controls below produce current evidence:

1. **Supply-chain promotion verification**
   - deterministic deploy bundle;
   - CycloneDX 1.7 SBOM;
   - build provenance attestation;
   - SBOM attestation;
   - verification against expected repository/workflow/SHA before deployment;
   - retained promotion evidence.

2. **Restore/rollback drill**
   - tested frontend rollback;
   - stateful intake recovery procedure;
   - measured RPO/RTO;
   - D1 recovery drill on a safe non-production recovery target or other approved non-destructive method;
   - current evidence no older than 30 days.

The proposed Pages workflow in the institutional production PR implements the first blocker. The second remains fail-closed until a safe recovery target and evidence are available.

## 2026 institutional baseline

### Cybersecurity and governance

- NIST CSF 2.0, including the Govern function.
- OWASP ASVS 5.0.0 and OWASP Top 10:2025.
- NIST SP 800-218 SSDF 1.1.
- NIST IR 8587 for identity/access token and assertion protection.

### AI and agentic systems

- NIST SP 800-218A.
- NIST AI RMF 1.0 and NIST AI 600-1.
- OWASP Top 10 for Agentic Applications 2026.
- OWASP GenAI LLM Top 10 2026.
- OWASP MCP security guidance.
- Probabilistic output may propose but never independently authorize a critical action.

### Software supply chain

- SLSA 1.2 concepts.
- GitHub Actions pinned to full commit SHA.
- CycloneDX 1.7 or stable SPDX 3.0.1 for BOM evidence.
- Artifact provenance/SBOM attestations must be verified, not merely generated.
- SPDX 3.1-RC1 is evaluation-only until stable.

### Reliability

Required operational evidence includes SLOs, error budgets, synthetic monitoring, alert delivery, rollback, restore, capacity/quota headroom, and dependency-failure degradation.

Transport-level synthetic failures may be retried a bounded number of times. Semantic failures, authorization failures, persistent HTTP errors, policy failures and content mismatches must never be converted into PASS by retries.

### Data

Every material data product should carry provenance, event/ingestion time, schema version, transformation lineage, retention class and quality state. Facts, inferences, hypotheses and unverified external data must remain distinguishable.

### Quantitative research

Trading remains `RESEARCH_ONLY_NO_LIVE_CAPITAL`. Promotion requires point-in-time data, leakage controls, trial registry, out-of-sample/walk-forward evidence, realistic costs/slippage/latency, multiple-testing adjustment, Deflated Sharpe/PBO or equivalent selection-bias controls, stress/regime testing, independent reproduction, paper/testnet reconciliation, hard limits/kill switches and explicit human capital approval.

### FinOps

Normalize cost/usage where practical with FOCUS 1.4 and track unit economics such as cost per valid intake, correct policy-compliant agent result, and reconciled commercial outcome.

## Promotion rule

A public site being live does not authorize the commercial runtime, agent fleet, social publication, connectors, financial side effects, or trading.

The institutional production decision may become true only when every applicable domain is independently authorized on current exact-revision evidence and a human production approval is recorded.


## Evidence refresh — 2026-09-20

Certified public release baseline: `cf190d28282958ff4f04f74e0325109df5c7b62e`.

Current evidence:

- Pages deployment run `35481552952`: PASS.
- CycloneDX 1.7, signed provenance and pre-deploy attestation verification: PASS.
- Promotion artifact `10595394537`, digest `sha256:2dd541430d0df713950af7f6e429b54c729b083ff3dc3f55265b6af7e8a4b073`.
- Security baseline run `35481552955`: PASS.
- Governed intake live contract run `35481579425`: PASS.
- Live Android max-8/single-owner regression run `35481579443`: PASS.

The Pages workflow is now scoped to the actual release surface. Governance-only changes no longer create a new public release SHA.

### Remaining public-site gates

`PRODUCTION_DOMAIN_GATE` remains fail-closed because:

1. `RESTORE_ROLLBACK_DRILL=NOT_YET_CERTIFIED` until the dedicated `*-recovery-drill` D1 database is provisioned and the approval-gated Stage B workflow records data correctness, undo bookmark, RPO/RTO and an attested evidence bundle.
2. `SLO_ERROR_BUDGET_ALERTING=NOT_YET_CERTIFIED` until measured observation history and alert-delivery evidence exist. The hourly measurement workflow is `.github/workflows/site-slo-evidence.yml`.

Implementation is not evidence. Neither of these gates becomes PASS merely because the workflow exists.

### Independent domains

Commercial intake authorization, agent-service authorization, social publication, external connectors and quant/live-capital authorization remain independent. A public-site PASS cannot promote those domains.


## D1 recovery certification — 2026-09-20

`RESTORE_ROLLBACK_DRILL` now has real PASS evidence from isolated D1 recovery target `jadel-commercial-runtime-recovery-drill` (UUID `a23852a8-7cf0-409a-a9cc-6eb317c55a11`).

Evidence: run `35487635556`, job `106016824689`, artifact `10598422044`, digest `sha256:e591b70d9b72322a2fbf81e290e5218ce44db3d1aa66953993a5c48e4898884b`. Measured restore RTO was `1175 ms`; recovery-point age was `1 s`; data correctness and attestation verification passed; production D1 was not touched.

The persistent environment authorization flag remained `ALLOW_D1_RECOVERY_DRILL=false` before and after execution. The temporary one-shot workflow is removed after use.

`PRODUCTION_DOMAIN_GATE` remains fail-closed because `SLO_ERROR_BUDGET_ALERTING` still requires its measured observation window and alert-delivery evidence. Independent agent, connector, social and quant/trading authorizations remain unchanged.


## SLO/error-budget certification bootstrap — 2026-09-20

The final public-domain technical gate is now operationally instrumented.

Real bootstrap evidence:

- first-attempt public synthetic run `35488352198`, job `106018729362`: PASS;
  - public site first-attempt latency: `227 ms`;
  - commercial intake health first-attempt latency: `152 ms`;
  - no retry was substituted for the measured SLI;
  - artifact `10597703848`, digest `sha256:33699fa579d12b081e8f0592ee94ccf8989d28d8921e1751bc9a290305efdcc6`.
- alert-delivery run `35488352208`, job `106018729600`: PASS;
  - controlled GitHub Issue create/read/comment/close round trip: PASS;
  - alert evidence attestation verification: PASS;
  - artifact `10598088523`, digest `sha256:0d7ef02832631fc915cf3a30fda8aa766fcf15975a57e273e742a25298206e80`.
- corrected 30-day certifier run `35488501229`, job `106019132700`:
  - daily rollups discovered: `1`;
  - alert delivery: `PASS`;
  - eligible historical scheduled slots: `0 / 4320`;
  - status: `NOT_YET_CERTIFIED`;
  - final certification evidence attestation: PASS;
  - artifact `10598047338`, digest `sha256:265ed350d335c4ff0675d2261989018f4a46246a420134d2979b084461ea7aea`.

The bootstrap probe was triggered by a source push and is intentionally excluded from the certification coverage numerator. Only scheduled first-attempt probes may count toward the 30-day window.

The alert-delivery sub-control is therefore already proven. The remaining blocker is elapsed, eligible measurement time. That time is not backfilled, inferred from traffic analytics or fabricated from pre-policy history.

With the 10-minute schedule active during Sep-20, the first possible fully observed UTC calendar day is Sep-21. If coverage and all SLO/error-budget controls remain satisfactory, the earliest 30-complete-day window is Sep-21 through Oct-20, adjudicated by the certifier scheduled for 2026-10-21 02:13 UTC.

Until that evidence exists:

`SLO_ERROR_BUDGET_ALERTING=NOT_YET_CERTIFIED`

and therefore:

`PRODUCTION_DOMAIN_GATE=FAIL`

remain mandatory fail-closed states.
