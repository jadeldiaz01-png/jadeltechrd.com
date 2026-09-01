# Agentic routing policy

Use deterministic workflows when the sequence, side effects or compliance requirements are known. Use a single agent when one model can reliably complete the task with a small tool surface. Use agents-as-tools when a manager benefits from specialized bounded capabilities. Use handoffs only when ownership of the conversation/task must actually transfer.

No probabilistic component is authoritative for permission, money movement, publication, contract acceptance, credential changes, production deployment, live-market actions or destructive operations. Those decisions are enforced by deterministic policy/risk/identity gates and human approval where required.

Every agent declaration should include purpose, allowed tools, denied actions, data classification, model/routing policy, maximum tool/cost budget, timeout/retry behavior, handoff contract, required evidence and maturity state. Tools are deny-by-default and granted by least privilege.

Memory is separated into ephemeral task context, user/project preferences, durable operational records and retrieval/knowledge sources. Operational truth remains in transactional stores/evidence, not conversational memory.

Agent evaluations cover task correctness, tool selection, policy compliance, hallucination rate, context efficiency, latency, cost, adversarial prompt/tool injection and safe failure behavior.