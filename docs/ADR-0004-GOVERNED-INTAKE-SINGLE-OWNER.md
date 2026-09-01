# ADR-0004 — Governed intake single-owner architecture

Status: Accepted for implementation
Date: 2026-09-01

## Context

The homepage configurator currently has two writers for the same CTA state: `app.js` and a compatibility `project-intake-bridge.js`. The bridge exists to override legacy PayPal/mailto behavior. This duplicated ownership has caused correctness drift and contributed to a production browser freeze investigation.

## Decision

`app.js` will become the sole owner of homepage configurator state and governed intake routing. The canonical CTA for any non-empty selection is:

`/solicitar-proyecto.html?services=<comma-separated-service-ids>`

The governed CTA will never perform direct payment, contract acceptance, publication, credential mutation, production deployment, trading or another critical side effect.

`project-intake-bridge.js` is a temporary compatibility shim only. It must be removed after the replacement browser E2E passes in production.

## Consequences

- One state machine and one rendering path own selection, estimates and CTA routing.
- Payment is downstream of validated intake, policy, human approval and reconciliation; it is not a homepage navigation concern.
- Browser tests become deterministic and can assert a single source of truth.
- Platform Registry and OPA policy remain authoritative for external side effects.
- A direct email contact may remain as an explicit secondary contact mechanism, but not as the governed intake CTA.

## Verification

Promotion requires: unit/contract tests, real-browser CTA E2E, live form/CORS/Turnstile checks, no `mailto:` or PayPal URL in the governed CTA path, and successful D1/evidence/outbox verification for a human-submitted intake.