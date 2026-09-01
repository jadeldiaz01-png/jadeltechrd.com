# Control-plane security boundaries

The public website is an untrusted input surface. It may collect a project request but cannot grant runtime authority. The commercial runtime validates schema, origin, anti-abuse challenge, idempotency and persistence before any workflow progresses.

Policy, identity and risk are separate control boundaries. OPA decides policy; OpenBao issues workload-scoped secrets/credentials; application code enforces the decision and records evidence. No single model response or browser state can replace these controls.

External platforms are independent trust domains. Each adapter is constrained by the Platform Registry and least-privilege credentials. Cross-platform publication or payment authority is never inferred from another platform's certification.

Payment state, publication state and financial/trading state remain separate domains with their own ledgers and reconciliation. Analytical telemetry is not authoritative operational state.