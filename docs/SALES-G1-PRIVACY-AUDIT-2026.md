# G1 — Sales & Lead Intelligence privacy certification evidence (2026-10-08)

**Gate:** G1 · PRIVACY. **Result:** `BLOCKED`. **Scope:** read-only static source inspection at main `b66c547c9df44421679021b4d74c328d1cb84ae5`; no live D1 reads, CRM, mail, external contacts, provider permissions or deployments. **Evidence:** `config/sales-g1-privacy-audit-2026.json`. Automated baseline validator and adversarial checks under `scripts/validate-sales-g1-privacy-audit.mjs`, `tests/sales-g1-privacy-audit.test.mjs`.

This is an **audit evidence package**, NOT an affirmative personal-data compliance certification. The validator passes only when it consistently documents G1 as blocked, checks versioned Git blobs and rejects false evidence. A green CI does **not** mean G1 passed.

## 1. Scope and inspected code

- `solicitar-proyecto.html`: a **required** privacy checkbox limits the visible form to a response-to-request purpose.
- `project-request.js`: `payloadFromForm()` serializes name, email, company, services, notes, locale, anti-abuse token, campaign attribution but not the privacy checkbox state, notice version or evidence of collection purpose.
- `commercial-runtime/src/validation.mjs`: server allowlist and validation contain no privacy consent/purpose receipt field.
- `commercial-runtime/src/worker.mjs`: request SQL and project accepted evidence do not durably record the user's notice/version and purpose consent.
- `commercial-runtime/migrations/0001_init.sql`: stores name/email/company/notes; the reviewed table definition has no dedicated consent receipt, purpose ledger or retention class.
- `commercial-runtime/migrations/0004_revenue_intelligence.sql`: recognizes lead origin enum `human|crm|verified_import`, but that alone is not provenance, lawful basis or permission to contact.
- `commercial-runtime/migrations/0007_offer_attribution.sql`: stores campaign attribution, not an authorized lead-source license, opt-in or retention schedule.
- `index.html`: privacy and data-deletion information is public, with a contact channel. It does not prove fulfillment of actual erasure/access requests.
- `analytics-consent.js`: separate optional analytics consent, never sales marketing consent.
- `config/sales-lead-intelligence-production-readiness-2026.json`: G1 is already `BLOCKED`, and production authority remains false.

**Confirmed P1:** the website checkbox alone is not an auditable, server-validated receipt. **Uncertified P1 controls:** lead-source provenance, contact suppression, rights/DSAR execution, per-purpose data expiry/backup purge, and jurisdiction-specific legal sign-off.

> Do not automatically force a new frontend field into the existing production API while this audit is in progress. That would affect the public intake contract and can disrupt legitimate client requests. Design a separate implementation PR with versioned schema/migrations, safe rollout, backward compatibility decision, negative E2E tests, and separate human approval.

## 2. Consent and purpose separation

Three distinct activities must remain independently authorized:

| Purpose | Current finding | Future proof |
|---|---|---|
| **Inbound project request** and direct reply | Browser checkbox visible; no server-recorded receipt | Immutable notice `notice_id,notice_sha256,locale,purpose_id,accepted_at,record_id,decision` and public service contract tests; policy/legal choice for old requests |
| **Sales analytics / lead scoring** | Intent stated in manifest but not independently evaluated | Data protection impact review where required, lawful basis, minimization, protected snapshots and tenant scope |
| **Marketing / outbound prospecting** | **DENIED**; no certified provider or purpose proof | Applicable law and terms; independently validated preference/legal basis, effective suppression and signed human approval per action |
| **Site traffic analytics** | Separate analytics preference UI exists | Confirm provider-specific consent behavior and PII-safe exports separately; not a marketing opt-in |

For future contact, require cryptographically anchored source provenance (`source_id,observed_at,source_rights,collection_purpose,authority,notice_version,jurisdiction`) plus provider address or platform permissions. **If any of these are UNKNOWN, stop.** A first-party inbound inquiry is not blanket consent to promotional follow-ups.

## 3. Risk controls requiring a separate implementation and certification

**Source / ingestion:** per-tenant isolated record; metadata provenance, publisher license/ToS checks, independent source hash, no scraping bypass, explicit data minimization, immutable event lineage and point-in-time timestamps. A bare `source='verified_import'` flag does not verify a license.

**Suppression:** lawful opt-out/objection API or reviewed manual intake; idempotent state transition; suppression keyed by tenant and normalized address/identity; check both before scoring/outreach intent and immediately before sending; fail closed during stale, unavailable or conflicting state; reconcile provider-side sends and revocations. Record minimized proof without storing unnecessary PII.

**Rights/DSAR:** identity verification proportional to the action; access, correction, objection, deletion requests with audit IDs, deadlines by applicable law, authorized exceptions, immutable suppression tombstone, cascade to derived views/embeddings/analytics and restoration-safe deletion. No actual personal records may be exported into CI test artifacts.

**Retention:** per-purpose classification (request/contract/payment/marketing suppression/audit), legally and contractually reviewed duration, expiry/hold metadata, purge job, dry run, observation logs and backup tombstones. Current duration remains `null`; **do not invent 30/90/365-day limits** or auto-enable a delete job.

**Transfers and vendors:** current controller/processor inventory and data-flow map including Cloudflare and any eventual CRM, email, storage, AI model/analytics services; geographic transfers, contracts, access control, secrets and record-level segregation. Reassess before adding any external vendor.

**Incident response:** notification thresholds, response owner and forensic hash bundle; any opt-out bypass, unapproved contact, accidental profiling or PII leakage forces G1 to BLOCKED and halts outbound.

## 4. Legal applicability and primary evidence (not legal advice)

**Dominican Republic — Ley 172-13.** Official published text (Superintendencia de Bancos): https://sb.gob.do/media/4i1ploou/ley17213.pdf . Articles 2–5 address scope, personal data, purpose/accuracy/security and rights. **Nuance:** Article 4 lists exclusions for some corporation/professional-contact datasets. This exclusion is not a universal permission for marketing, scraping or transferring addresses; require counsel to classify actual fields and purposes.

**Dominican Republic — Ley 310-14.** Government-hosted official copy: https://justicia.gob.do/wp-content/uploads/2025/10/ley-310-14-2.pdf . Articles 4–6 address commercial sender disclosures and reply mechanisms. Articles 7–10 regulate unsolicited email, exceptions (prior relationship or permission), objection and revocation; Article 9 provides the five-calendar-day post-opt-out sending restriction. **Use immediate suppression technically** rather than treating a legal deadline as permission to send after an objection. Confirm channel reach and interpretation with qualified counsel.

**European Union/EEA (conditional).** European Commission: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en ; direct-marketing objection under GDPR Article 21 stops use for that purpose. Validate GDPR Article 6 basis, Article 14 notices where relevant, ePrivacy and local laws per recipient geography/communications method. B2B does not universally exempt personal data or all e-marketing rules.

**United States (conditional).** FTC guidance: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business . CAN-SPAM applies to commercial email including B2B. It generally does not require affirmative prior opt-in, but requires accurate sender/subject, postal contact, working opt-out and prompt honoring (10 business days); additional state or sectoral laws and provider terms may matter. Do not transplant US law as Dominican opt-in policy.

**Channels:** WhatsApp Business, LinkedIn, Meta or a CRM/email delivery API need separate official provider permission/terms review and explicit human selection; this G1 audit does not choose, connect or certify any.

## 5. G1 acceptance protocol

1. **Legality:** annotated per-country/per-channel dataset matrix and counsel signature, controller/processor arrangements, cross-border decisions.
2. **Receipt:** immutable server-side purpose and notice/version + timestamp tied atomically to accepted request; replay without valid evidence must fail safely and not break legitimate existing flows.
3. **Provenance:** source-to-contact receipt including observed time, data quality, permission and lawful-purpose judgment; adverse import fixtures rejected.
4. **Suppression:** zero sends after objection; negative tests of simultaneous sends, provider timeout, stale opt-out, all-tenant isolation.
5. **DSAR:** verified end-to-end synthetic requests and restoration/backup reintroduction test, with legal holds handled.
6. **Retention:** approved per-purpose policy, safe scheduler, reconciliation of expired datasets and data derivatives, proof of execution.
7. **Runtime and approvals:** authenticated operation receipts, observability and source-to-runtime binding, human sign-off. No live contacts should be involved without separate approval.

**Outcome of this PR:** freeze the exact observed baseline, codify all six P1 findings, add adversarial regression tests and preserve G1 `BLOCKED`. No real user records were examined, no emails were sent and no live network changes were authorized. Do not merge or deploy without independent exact-SHA approval.
