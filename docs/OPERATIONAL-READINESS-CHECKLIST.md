# Operational readiness checklist

Before any service is considered production-capable: health/readiness checks, dependency timeouts, bounded retries, idempotency, UNKNOWN reconciliation, rollback/degradation, backup/restore, alerting, incident runbook, evidence retention, least privilege, policy failure behavior, cost ceilings and a named human owner must be verified.

For externally visible actions, add remote read-back/reconciliation and platform-specific certification. For money or market actions, add independent ledger/risk controls and explicit human approval.

The checklist is a gate definition; completion must be backed by machine-verifiable or reviewable evidence.