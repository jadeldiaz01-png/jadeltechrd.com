# FinOps and capacity controls

Every agent/platform integration must declare measurable cost dimensions before production promotion: model tokens, third-party API calls, storage, egress, Workers/Workflow invocations, database operations, observability volume and human-review time where material.

Budgets are enforced at project, agent, platform and environment levels. Recommended controls include hard monthly ceilings for non-critical experimentation, alert thresholds, per-request cost attribution, rate/queue limits, concurrency caps, model routing tiers and retention limits for telemetry/evidence.

Cost efficiency is evaluated as cost per correct, policy-compliant, reconciled outcome rather than cost per raw request. Retries, duplicated work, failed tool calls and low-quality generations count against the budget.

Capacity planning must consider steady-state load, bursts, downstream provider limits, queue/outbox growth, recovery after outage and observability backpressure. Rate-limit counters are abuse controls and must not be used as exact billing/accounting data.

Production changes that materially raise fixed cost, autonomous spend authority or external financial exposure require a separate human approval gate.