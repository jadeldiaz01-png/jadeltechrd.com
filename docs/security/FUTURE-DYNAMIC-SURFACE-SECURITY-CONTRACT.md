# Jadel Tech RD — Future Dynamic Surface Security Contract

## Purpose

This contract becomes mandatory before the public site adds any form that submits data, `/api/*` route, login/session flow, upload, payment endpoint, webhook receiver, agent-execution endpoint, serverless function, Worker, backend or WebSocket.

The current public site is static, so these controls are not yet production dependencies. The permanent workflow `.github/workflows/future-dynamic-surface-security.yml` detects the introduction of a dynamic attack surface and fails closed unless the security manifest and required tests exist.

## Mandatory controls

A future `security/api-security-manifest.json` must explicitly attest and link evidence for:

1. **Turnstile / bot-abuse control** on abuse-prone anonymous public forms.
2. **Endpoint-specific rate limiting** for public APIs, login and write endpoints.
3. **Schema validation** with unknown-field rejection where practical.
4. **Request-size limits** before expensive parsing or downstream calls.
5. **Authentication and authorization model review**, including explicit policy for intentionally public endpoints.
6. **CSRF model review**, with protection required when ambient cookie credentials are used.
7. **Server-side secrets only**; no privileged secret may be shipped to browser JavaScript.
8. **Idempotency** for externally visible or financially meaningful side effects.
9. **Audit/correlation IDs** propagated through requests and external actions.
10. **SSRF/egress policy review** for every server-side URL fetch, webhook callback or connector.

## Required adversarial tests

The manifest must point to executable repository paths covering at least:

- injection
- SSRF
- replay/idempotency
- broken access control / authorization

Additional tests are required when applicable: CSRF, file upload/content-type confusion, deserialization, webhook signature verification, credential stuffing, enumeration, mass assignment, concurrency/race conditions and resource exhaustion.

## Reference architecture

```text
Browser
  -> Cloudflare
     -> WAF
     -> Turnstile (abuse-prone public form)
     -> endpoint rate limit
  -> API/Worker
     -> request size limit
     -> schema validation
     -> authentication
     -> authorization
     -> idempotency
     -> business/policy gate
     -> external connector
     -> audit/evidence
```

## Fail-closed promotion rule

A pull request that introduces a detected dynamic surface without the manifest or required adversarial-test paths must fail. A green manifest is not sufficient by itself for production promotion: the referenced tests must exist and higher-risk endpoints require explicit threat-model review before deployment.

## Standards baseline

Use OWASP API Security guidance and current Cloudflare WAF/Turnstile/rate-limiting documentation as the minimum external baseline. Controls should be tightened based on the endpoint's data sensitivity, side effects and abuse economics.
