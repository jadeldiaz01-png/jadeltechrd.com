# QA and adversarial certification matrix

Before a platform reaches `verified_runtime`, test the integration across deterministic contracts and adversarial cases.

Required categories: schema/contract validation, authentication expiration, missing/wrong scopes, revoked credential, rate-limit responses, timeouts, duplicate submissions, replay with changed payload, concurrent execution, partial downstream success, UNKNOWN state, reconciliation after crash, malformed remote response, remote 4xx/5xx, webhook duplication/reordering, stale callbacks, prompt/tool injection at every untrusted text boundary, unauthorized tool selection, path/URL injection, SSRF controls, privilege escalation attempts, secret/PII leakage, policy-engine unavailable/stale/corrupt, OpenBao unavailable/audit blocked, queue backlog, database contention, deployment rollback, and evidence-ledger failure.

Agent evaluations additionally measure hallucinated capabilities, unsupported production claims, failure to distinguish facts from inference, unsafe handoffs, excessive tool calls, context/token waste and attempts to bypass approval gates.

Chaos tests are allowed only in isolated or explicitly authorized environments. Production chaos requires a separate change plan, blast-radius limits, rollback, SRE ownership and human approval.

Passing one happy-path E2E is necessary but insufficient for certification.