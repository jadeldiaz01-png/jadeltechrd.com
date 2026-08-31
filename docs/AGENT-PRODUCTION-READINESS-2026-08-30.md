# Jadel Tech RD — Agent Production Readiness Program (2026-08-30)

## Institutional decision

The five catalog services currently marked as supervised pilot remain pilots until machine-readable evidence proves every common and service-specific production gate. The website is not allowed to promote a blocked service to `available` merely because an LLM, operator, README, marketing page or isolated test says it is ready.

The authoritative contract is `config/agent-production-readiness.json`; `security-baseline` executes `scripts/validate_agent_production_readiness.py` on every pull request to `main`.

## Pilot portfolio and quantitative baseline

The score is the percentage of explicit boolean gates currently satisfied. It is an engineering coverage metric, not a probability of safety or profitability.

| Service | Explicit gates passing | Current score | Production decision |
| --- | ---: | ---: | --- |
| Sales & Lead Intelligence | 6 / 22 | 27% | BLOCKED |
| Social Trend Intelligence | 12 / 23 | 52% | BLOCKED |
| CineForge · Video Premium | 11 / 23 | 48% | BLOCKED |
| Revenue Opportunity Intelligence | 14 / 22 | 64% | BLOCKED |
| Multi-Agent Orchestration | 6 / 24 | 25% | BLOCKED |

A service reaches production only at 100% required gates, zero blocking gates, exact-SHA evidence and current external contract evidence where applicable.

## Architecture target

```text
Public Jadel Tech catalog
        |
        v
Production Readiness Manifest (authoritative)
        |
        +--> Service composition / source SHAs
        +--> Common security + reliability gates
        +--> Service-specific gates
        +--> Human/platform/evidence blockers
        |
        v
Required CI validator (fail closed)
        |
        +--> Agent/runtime tests
        +--> Adversarial evals
        +--> Supply-chain evidence
        +--> OpenTelemetry evidence
        +--> SLO/runbook evidence
        +--> External sandbox/live contract evidence
        |
        v
Promotion decision
  BLOCKED -> CONDITIONAL -> PRODUCTION_READY
```

## Research-derived controls adopted

### Agentic safety and evaluations

OpenAI's 2026 production-agent material treats tools, instructions, handoffs, routing, guardrails, tracing and evals as core production constructs. Jadel Tech therefore requires explicit tool scopes, deterministic critical-action gates, traceable handoffs and eval evidence rather than relying on an agent's self-assessment.

References:
- https://academy.openai.com/en/public/clubs/builders-etkn1/events/builder-bootcamp-agents-tf1pr0zo5i
- https://evals.openai.com/

OWASP's current GenAI risks include prompt injection, sensitive-information disclosure, supply-chain risk, improper output handling, excessive agency, vector/embedding weaknesses, misinformation and unbounded consumption. Pilot promotion therefore requires adversarial prompt/tool tests, output validation, least privilege and bounded resource use.

References:
- https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- https://owasp.org/www-project-top-10-for-large-language-model-applications/2_0_vulns/LLM06_ExcessiveAgency.html

### AI governance

The program maps governance to NIST AI RMF's Govern / Map / Measure / Manage lifecycle. Risks must be continuously documented, measured and managed; production deployment is a risk decision backed by evidence, not a one-time checklist.

References:
- https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook
- https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence

### Observability

Production agents must emit traces/metrics/logs sufficient to distinguish model latency, tool latency, retries, routing and token consumption. The target is OpenTelemetry GenAI semantic conventions, with prompt/content capture opt-in and privacy-controlled rather than enabled indiscriminately.

Reference:
- https://opentelemetry.io/blog/2026/genai-observability/

### Supply chain

Production artifacts should carry provenance; released executable/package artifacts should use GitHub artifact attestations and, where useful, SBOM attestations. GitHub documents that artifact attestations provide SLSA v1 Build Level 2 provenance; dependency review/Dependabot should stop newly introduced vulnerable dependencies before merge where repository/plan support permits.

References:
- https://docs.github.com/en/actions/concepts/security/artifact-attestations
- https://docs.github.com/en/code-security/concepts/supply-chain-security/supply-chain-security
- https://slsa.dev/spec/v1.2/build-track-basics

### Dynamic public surfaces

When a pilot gains a public form, API or login, Turnstile must be validated server-side; client-only widgets are insufficient. Tokens are single-use and expire after five minutes. Endpoint-specific Cloudflare rate limiting is required for abuse-prone routes such as authentication and public APIs.

References:
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/waf/rate-limiting-rules/

## Service-specific promotion contracts

### Sales & Lead Intelligence

Production requires a dedicated runtime or certified control-plane composition, CRM/delivery connector, consent/contact policy, identity/TOS checks, bounded outreach quotas and human approval before an external message is sent. No autonomous spam, impersonation or unauthorized scraping.

### Social Trend Intelligence

Production requires terms-allowed/official signal sources, freshness/velocity scoring, source lineage, rights/originality review, policy review and feedback evidence. A high-view signal does not override rights or platform policy.

### CineForge

Production requires video QC, originality review, managed platform credentials, verified account permissions, platform posting review/audit where required, human approval and live/sandbox contract evidence. Current CineForge documentation explicitly keeps live publishing disabled until those external gates are verified.

### Revenue Opportunity Intelligence

Production requires authenticated external settlement evidence, complete cost attribution and multiple independent positive windows. Provider balances, simulated earnings and payout initiation are not settled cash. Financial/provider-write authority remains fail-closed and human-gated.

### Multi-Agent Orchestration

Production requires a service-neutral agent registry, capability-scoped tool registry, durable workflow state, idempotency/reconciliation, handoff contracts, recursion/token/cost limits, cross-agent prompt-injection tests and end-to-end telemetry. Critical external actions cannot depend exclusively on probabilistic agent output.

## Promotion invariant

`PRODUCTION_READY` is valid only when:

1. Every common gate is `true`.
2. Every service-specific gate is `true`.
3. `blocking_gates` is empty.
4. The exact source SHA is recorded and current.
5. Required external platform/credential/settlement evidence is current.
6. The public catalog status changes to `available` in the same reviewed change.
7. Required CI remains green.

Any regression returns the service to blocked/conditional status; availability is not grandfathered.
