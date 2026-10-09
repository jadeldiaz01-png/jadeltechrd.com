# Sales & Lead Intelligence — institutional production readiness (2026)

**Date:** 2026-10-08. **State:** `SUPERVISED_PILOT / BLOCKED`. **Contract:** `config/sales-lead-intelligence-production-readiness-2026.json`.
**Review base:** jadeltechrd.com main `ebdba272b69c2858c60713fa742f00f69bd2f5e8`.
This is a research-informed, machine-validated **readiness contract**, not proof of a production deployment or authorization to contact anyone.

## 1. Evidence classification and findings

| Observation | Classification | Evidence or next proof |
|---|---|---|
| Public service currently claims SUPERVISED_PILOT | Inspected repository fact | `agent-services.json`, pinned blob in contract |
| Sales pricing is setup from $1,500 and monthly $299 | Inspected repository fact | `commercial-runtime/src/service-pricing.mjs` |
| Main sales readiness decision is BLOCKED | Inspected repository fact | `config/agent-production-readiness.json` |
| A CRM/email platform is authorized, and send receipts exist | **Not verified** | Provider-scoped identity, sandbox logs, verified send/response/opt-out receipts |
| Sales scoring achieves lift over a simple baseline | **Not measured** | Frozen temporal cohort, complete denominator, experiment log, confidence intervals |
| Production SLO, restore, and customer economics are certified | **Not verified** | Independently archived telemetry, restore drill, cost ledger and human sign-off |

Evidence is not inherited between products. An old SHA reference proves which code was inspected, not that the code ran successfully on a target system. Exact provider credentials must never be stored here.

### P2 hardening — evidence identity and external provenance

The static G0 validator now requires **all nine unique evidence blockers**, all nine immutable `id -> URL` research references (source type, frozen review date and `REFERENCE_ONLY_NOT_INDEPENDENTLY_VERIFIED` status), and all four unique `id -> path -> git blob SHA` local code observations with strict record shape. Missing, duplicated, substituted, misbound or injected fields fail closed. This is a **structural integrity and local Git-blob check**, not independent verification that any cited external web page remains accessible or accurate today. External research must be revalidated during the relevant gate.

The private `ai-income-revenue-engine` provenance is explicitly **`REGISTRY_COMMIT_REFERENCE_ONLY / NOT_CERTIFIED`**. Local sales capability/readiness documents must agree on the reference SHA, but this does not authenticate the private source tree, transitive build inputs, signed artifact, deployment digest or real provider receipts. All these fields remain false/null/empty with an enumerated evidence inventory. To promote the engine, a *different authorized read-only certification process* must establish source-to-artifact-to-runtime binding with independently verified provenance, separate provider contract tests, and human approval. This PR does not invoke that process, access secrets, connect a CRM, send messages or enable production.


## 2. Architectural decision ADR-SALES-001

Use existing boundaries before introducing new infrastructure:

```text
Customer / authorized permitted source
      | validation + origin + lawful-use check
      v
Commercial intake (authoritative) -> tenant-scoped durable lead/evidence record
      |                               + source hash/observed_at/legal purpose
      v
Deterministic dedupe / suppression -> feature snapshot at decision time
      |                               -> scoring baseline and optional challenger
      v
Human-review queue -> proposal/message draft [PREPARE_ONLY]
      |
      +-- external CRM, email, WhatsApp or marketplace -> DENY by default
      |     independently certified connector + per-action approval required
      +-- immutable audit / observability / cost ledger / error recovery
```

The workflow engine owns states, retries, idempotency and permissions. An LLM may research, extract evidence, summarize, or draft, but can neither grant authority nor override consent. Use one supervised agent with tools by default; add subagents, RAG, a vector store or knowledge graph only after quality/latency tests demonstrate a specific advantage. A graph could later represent company-contact-event-provenance relationships, but a relational schema with unique keys is the default operational source of truth.

**Durability:** tenant-bound idempotency key = HMAC/UUID over authorized request key plus action type/destination; never key only on the lead email. Persist approval, outbox intent, provider request ID and response in a transactionally consistent state machine. Retries use idempotent provider APIs or reconcile before retrying; ambiguous sends are quarantined, never automatically resent. Enforce per-tenant authorization at DB and API layers, not only in model prompts.

## 3. Data and privacy operations

- Classify and minimize company/contact PII. Retain collection purpose, lawful basis or applicable permission, jurisdiction, source and observation time; redact PII in logs, prompts, embeddings and telemetry.
- Revalidate revocations/suppression at decision time AND immediately before any send; deletion/objection must propagate to cache, derived indexes and providers under a reviewed retention schedule. Do not invent a universal number of retention days.
- Use only first-party authorized intake or independently reviewed provider/official sources. Public accessibility alone does not grant scraping rights. No CAPTCHA bypass, profile harvesting, impersonation or contact-list purchases without verified lawful basis.
- Model monitoring must disaggregate false positives, company duplicates, source staleness, drift, consent failures and unsupported assertions. Never classify a person's sensitive traits or infer protected categories for targeting.

**Jurisdiction matrix (apply only where legally relevant):**
US commercial email: FTC CAN-SPAM (including B2B), true origin, non-deceptive subject and opt-out handling; domain sender standards for Gmail. EU/EEA: GDPR basis, notices and immediate effective objection to direct marketing; assess EU AI Act role and transparency provisions. Dominican Republic: review Ley 172-13 and applicable subordinate rules. Meta/WhatsApp/LinkedIn: validate provider terms, approved APIs, identity/opt-in and templates with current provider material. Independent legal review is a promotion gate, not an assumption.

## 4. Quantitative research protocol — no fictional uplift

Define lead identity and timestamp at source acquisition, eligibility, qualification, contact, meeting and conversion. Preserve all attempted and rejected records to avoid survivorship/selection bias. For propensity scoring, start with an interpretable, deterministic ICP rule-set as baseline; train challengers only on consent-compatible, leakage-free snapshots.

- Freeze time-based TRAIN / VALIDATION / HOLDOUT, group accounts across splits, respect label maturation and prevent post-contact features from leaking into pre-contact predictions.
- Evaluate PR-AUC, Brier, calibration error, precision@20, lift@20, review false-positive rate, segmented stability and operational cost per *human-qualified* lead. Report bootstrap uncertainty and challenger-minus-baseline lift at same human review capacity.
- Proposed minimum evaluation sample: 200 matured holdout leads with 30 positives. This is a *screening floor*, not statistical assurance; calculate power and interval widths based on actual event rates and desired effect size. Initial proposed target: lift@20 >= 1.2 **with positive confidence lower bound over the baseline**, subject to prospective calibration.
- Run shadow mode before any campaign. Evaluate counterfactual impact of prioritization via random assignment/A-B where lawful and permitted; observational conversion gains are not causal proof.
- In production-like pilot, use per-campaign, per-channel cohorts. Avoid falsely treating delivery, open, click, reply, appointment, contract and **settled revenue** as the same outcome.
- FinOps unit economics: `gross_reconciled_revenue - platform_fees - variable_AI_API_cost - data_cost - communication_cost - allocated_servicing_cost`. Track cost/qualified lead, cost/meeting, cost/customer and complaint/opt-out rates using complete denominators. Set explicit budget first; current external autonomous budget is $0.

## 5. Promotion gates and evidence

| Gate | Owner | Proof required | Current |
|---|---|---|---|
| G0 code contract | Architect + QA | Source blob fingerprints, regression CI, exact SHA review | PENDING |
| G1 lawful collection/privacy | Governance + Data | Legal matrix, consent/suppression/deletion and retention E2E | BLOCKED |
| G2 security/supply chain | DevSecOps | Tenant authz, SSRF/prompt injection tests, signed release, SBOM, verified provenance | BLOCKED |
| G3 quant validation | Quant + AI | Frozen point-in-time holdout, CIs, cost/quality tradeoff | BLOCKED |
| G4 connector sandbox | Backend + Operations | Owner-approved provider, limited scopes, sandbox contract and replay/reconcile tests | BLOCKED |
| G5 supervised campaign | Sales + Governance | Explicit human action-level approval, permitted recipients, provider receipts and complaints/opt-outs | BLOCKED |
| G6 reliability/FinOps | SRE + FinOps | SLO window, on-call, backup/restore drill, error budget and approved cost ceiling | BLOCKED |
| G7 human promotion | Account owner | Reviewed diff, green required CI, explicit deployment and channel authorization | BLOCKED |

**Implementation order:** G0 independently reviewed -> G1 privacy foundation -> G2 API/tenant and supply chain -> G3 baseline scoring quality -> G4 sandbox connector -> G5 *authorized* low-volume supervised test -> G6 operational maturity -> G7 explicit deployment gate. Never turn G7 into an automatic inference from code or AI scoring. A single failure returns HOLD/BLOCKED.

## 6. Controls / threat model

Critical scenarios: source poisoning, malicious sales-page prompt injection, tool output instructing a hidden email send, malicious URLs/SSRF, tenant A accessing B, stolen approval IDs, late opt-out, provider timeout after send (exactly-once illusion), idempotency collision, forged click/conversion receipts, inflated ROI, leaking contact PII to vector indexes, model drift and run-away token or enrichment billing.

Required QA: unit + schema + contract + replay + fuzz/property + poisoned source + cross-tenant tests, actual provider sandbox integration, immutable approval expiry/non-reuse, safe cancellation, rate-limit exhaustion, backup/restore and incident drill. This PR provides **static fail-closed contract tests**, not a substitute for missing live/provider/E2E evidence.

Runbook on any unauthorized outbound event, data breach suspicion, opt-out failure, evidence inconsistency or cost ceiling breach:
1. Switch off outbound connector and revoke its capability lease; preserve forensic hashes/audit trail.
2. Halt retries; reconcile provider send IDs before any requeue.
3. Contain affected tenant, alert accountable human, follow incident/privacy response obligations.
4. Restore from verified recovery point only after root cause, regression and renewed human approval.
5. Reclassify affected production gate to BLOCKED, never silently mark it PASS.

## 7. Organization, RACI and operations

Architect: system boundaries + ADR. AI Engineer: prompt/tool routing, model registry, grounded evidence and evaluations. Backend: tenant transactions, outbox, idempotency and state machine. DevSecOps: scans, SBOM, pinned actions, provenance and artifact signing. SRE: SLIs/SLO, incidents, recovery tests. AI Governance: consent, legal matrix, review authority and audit. Quant: leakage-free design, causal test and model calibration. Social Analyst: approved sources, campaign content and rights; never autonomous posting. Data Architect: provenance, PII, retention and point-in-time snapshots. QA: adversarial/replay/end-to-end tests. FinOps: budgets, usage visibility and cost per correctly qualified outcome. **Human administrator:** owner-only authority for provider access, secrets, real campaigns, merge and deploy.

Operational targets in manifest (proposals, not results): 99.5% availability, scoring p95 under 2s, RPO 60min, RTO 240min; zero unauthorized outbound, zero duplicate sends, 100% suppression checks and source provenance. Baseline, alerts, on-call and error budgets must be measured and explicitly accepted before promotion.

## 8. Authoritative research snapshot (2026-10-08)

- NIST AI RMF + GAI profile: https://www.nist.gov/itl/ai-risk-management-framework
- NIST SSDF v1.1 final (v1.2 draft is not final): https://csrc.nist.gov/projects/ssdf/publications
- OWASP LLM Top 10 2026 / Agent Control Standard: https://genai.owasp.org/
- OWASP API Security risks: https://api-security.owasp.org/editions/2023/en/0x11-t10/
- SLSA v1.2 approved: https://slsa.dev/spec/v1.2/
- FTC commercial email guidance: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- Google Gmail sender guidelines: https://support.google.com/mail/answer/81126?hl=en
- European Commission marketing objections: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en
- EU AI Act and amended deadlines: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- Dominican legal portal Ley 172-13: https://www.dgcp.gob.do/transparencia/marco-legal

**CI scope:** contract and negative authority tests run on pull requests changing relevant files; there is no scheduled job, runner dispatch, deployment, credential access, messaging or payment action. To change status later, replace placeholders only with independently reviewed, SHA-bound evidence and add new tests proving every new capability; approval remains an external human gate.
