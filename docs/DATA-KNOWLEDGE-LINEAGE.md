# Data and knowledge lineage controls

Operational state, analytical aggregates, vector search content and graph relationships have different correctness and retention requirements and must not be conflated.

Every durable fact used for policy, customer state, payment, publication or financial reconciliation should carry source, observed/created time, environment, schema/version and trace/evidence reference. Derived values identify their inputs and algorithm/model version. Hypotheses and unverified external claims are stored or displayed as such and cannot silently become authoritative facts.

PII and secrets are excluded from default traces, model prompts, decision logs and analytics unless explicitly required and protected. Retention is purpose-limited. Deletion workflows must cover primary records, derived indexes and caches where legally/technically applicable while preserving immutable audit material only when a documented basis requires it.

RAG/knowledge sources require provenance, freshness and trust classification. Tool or retrieved content is untrusted input and cannot change permissions, policy or system instructions. A knowledge graph may support discovery and reasoning but is not an authorization source unless facts are promoted through a governed validation pipeline.

Production certification requires lineage tests for the platform's critical inputs and outputs.