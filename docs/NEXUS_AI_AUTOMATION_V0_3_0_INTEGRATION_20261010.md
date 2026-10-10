# Nexus AI Automation v0.3.0 Integration

Date: 2026-10-10
Scope: public website, governed commercial runtime, PayPal evidence flow and owner-approved operations.

## Production Decision

`nexus_ai_automation_v0.3.0` is integrated as a governed service router and evidence coordinator. The public website may advertise supported capabilities and route clients into the governed intake, but it must not expose admin endpoints, secrets, autonomous financial execution, contract acceptance, external publication or live trading.

## Capabilities Added To The Public Contract

- Service intake briefing.
- Service routing across the public catalog.
- Opportunity scoring.
- Proposal draft preparation.
- Quote and PayPal order workflow coordination.
- PayPal order evidence reconciliation.
- Work order generation.
- Support ticket triage.
- Lead research packet preparation.
- Social trend research packet preparation.
- Media pipeline quality review.
- Dashboard reporting.
- Governance readiness review.
- Multi-agent orchestration design.
- Quant research control review.

## Runtime Boundary

Public surface:

- `https://jadeltechrd.com/`
- `https://jadeltechrd.com/solicitar-proyecto.html`
- `https://jadeltechrd.com/agent-services.json`
- `https://jadeltechrd.com/llms.txt`

Owner-only surface:

- `https://jadeltechrd.com/approval-console.html`
- Commercial runtime endpoints protected by `ADMIN_API_TOKEN`.
- GitHub Actions workflows for live PayPal activation, capture and evidence audits.

## Human Approval Gates

The following actions remain blocked until explicitly approved by the owner or client evidence:

- Policy approval.
- Quote acceptance.
- Payment capture.
- Payment reconciliation.
- External messages.
- Social publication.
- OAuth scope grants.
- Production deployments.
- Contract acceptance.
- Infrastructure changes.

## Blocked By Default

- Secret exposure.
- Refunds, payouts and withdrawals.
- Autonomous financial execution.
- Autonomous contract acceptance.
- Autonomous social publication.
- Real trading.
- Spam.
- Impersonation.
- Unauthorized scraping.

## Current Production Status

Implemented:

- Public Nexus capability section on the home page.
- Machine-readable Nexus profile in `agent-services.json`.
- Nexus discovery note in `llms.txt`.
- PayPal order workflow coordination documented with LIVE order creation kept behind separate activation gates.
- Intake evidence workflow with project IDs.
- Owner approval console boundary.

Remaining before full automated fulfillment:

- Client-approved quote for each project.
- Verified PayPal order approval by the client.
- Signed PayPal webhook settlement evidence.
- Ledger reconciliation before marking paid.
- Owner approval before external side effects.
