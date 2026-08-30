# Jadel Tech RD — Security Assessment 2026-08-30

## Scope

Public architecture assessed:

- `https://jadeltechrd.com`
- Cloudflare authoritative DNS / reverse proxy / public TLS edge
- GitHub Pages static origin (`jadeldiaz01-png/jadeldiaz01-png.github.io`)
- Canonical source repository (`jadeldiaz01-png/jadeltechrd.com`)
- GitHub Actions deployment and synchronization workflows

This assessment is defensive. It does not claim that any internet-facing system can be made impossible to compromise.

## Architecture risk profile

The current public application is a static site. It has no public database, login endpoint, server-side session, file upload handler, payment endpoint, or application API. This materially reduces exposure to server-side classes such as SQL injection, SSRF, server-side RCE, credential stuffing against an application login, and unsafe deserialization. Future dynamic endpoints must receive their own threat model before deployment.

## Findings before hardening

| Finding | Initial severity | Evidence / impact |
|---|---|---|
| Canonical `main` branch not protected | High | Direct-push / supply-chain governance risk; no required checks at branch level. |
| Root Pages `main` branch not protected | High | Public serving repository could be changed without PR/status-check enforcement. |
| Several third-party GitHub Actions referenced mutable major-version tags | High | A compromised/moved tag could alter CI/deployment behavior. |
| Minimum Cloudflare TLS version was 1.0 | High/Medium | Legacy protocol versions accepted at edge. |
| Cloudflare Always Use HTTPS was off | Medium | HTTP was not centrally forced to HTTPS by this setting. |
| No HSTS observed | Medium | Browsers lacked transport pinning after first secure visit. |
| No effective CSP / anti-clickjacking / MIME-sniff / permissions / cross-origin response headers | Medium | Reduced browser-side defense in depth. |
| No managed WAF phase deployment was visible in the initial audit | Medium/Low for current static site | Free Managed Ruleset would add exploit-pattern defense; current site has low server-side attack surface. |
| No dedicated private security-reporting channel verified | Low | Responsible disclosure path should be formalized before a public security.txt is advertised. |

## Implemented controls

### Cloudflare edge — LIVE

Verified configuration:

- Minimum TLS: `1.2`
- TLS 1.3: enabled
- Always Use HTTPS: enabled
- Automatic HTTPS Rewrites: enabled
- Browser Integrity Check: enabled
- HSTS: enabled with `max-age=15552000` (180 days)
- HSTS `includeSubDomains`: disabled intentionally
- HSTS `preload`: disabled intentionally
- `nosniff`: enabled

A response-header Transform Rule now emits:

- `Content-Security-Policy` with deny-by-default policy, same-origin script/style/font/connect, no plugins, no base URI, no framing, and HTTPS upgrade
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- restrictive `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

Production verification job: GitHub Actions run `33315441016`, rerun job `99268073291`.

Verified live outputs included:

- `HEADER_Strict-Transport-Security=PASS`
- `HEADER_Content-Security-Policy=PASS`
- `HEADER_X-Frame-Options=PASS`
- `HEADER_X-Content-Type-Options=PASS`
- `HEADER_Referrer-Policy=PASS`
- `HEADER_Permissions-Policy=PASS`
- `HEADER_Cross-Origin-Opener-Policy=PASS`
- `HEADER_Cross-Origin-Resource-Policy=PASS`
- `LIVE_EDGE_SECURITY=PASS`

### Source/browser security — READY FOR MERGE

The source homepage now includes a restrictive CSP meta policy and strict referrer policy as defense in depth. Permanent `security-ci.yml`:

- rejects missing CSP controls
- rejects inline event handlers
- rejects `eval`, `new Function`, and `document.write`
- rejects insecure `http://` resource references
- requires every external GitHub Action to use a full 40-character commit SHA
- performs a Chrome headless smoke test under CSP

Security baseline run `33315249567` passed after remediation. A later baseline run `33315440990` also passed all source, immutable-action, and browser-CSP gates.

### GitHub Actions supply chain — READY FOR MERGE

Pinned canonical Actions include:

- `actions/checkout` → `11d5960a326750d5838078e36cf38b85af677262`
- `actions/configure-pages` → `983d7736d9b0ae728b81ab479565c72886d7745b`
- `actions/upload-pages-artifact` → `56afc609e74202658d3ffba0e8f6dda462b719fa`
- `actions/deploy-pages` → `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`

The actual root Pages sync workflow has already been pinned to the immutable checkout SHA.

## WAF status

Cloudflare Free Managed Ruleset is appropriate for the current Free plan and static architecture. An idempotent installer was prepared, but the current scoped token cannot read account-level managed-ruleset inventory. The attempt failed closed with HTTP 403 / Cloudflare authentication error for the account-rulesets endpoint before any managed WAF mutation occurred.

Status: `FREE_MANAGED_WAF = PENDING_AUTHORIZED_RULESET_PERMISSION`.

Do not broaden the token casually. Prefer a dedicated least-privilege credential or a directly connected Cloudflare administrative integration if this control is promoted later.

## Residual risks / required governance

### P0 — Repository governance

Both public-serving repositories currently report `main` branch protection disabled. Required target controls:

- require pull requests to `main`
- require successful security and production smoke checks
- block force pushes and branch deletion
- restrict who can push/merge
- require signed commits where operationally practical
- keep deployment environments least-privileged

This assessment does not mark this control complete because the connected GitHub integration does not expose an authorized branch-protection write operation.

### P1 — Managed WAF

Deploy Cloudflare Free Managed Ruleset once a least-privilege token/integration can enumerate and deploy the managed ruleset. Validate normal homepage and legal routes after deployment before marking PASS.

### P1 — Security reporting

Create a verified private security-reporting channel. Do not publish a `security.txt` containing an invented or unverified contact address.

### P2 — Future dynamic endpoints

If `/api/*`, lead forms, authentication, uploads, payments, or agent-execution APIs are added, require before production:

- Cloudflare Turnstile on abuse-prone public forms
- endpoint-specific rate limiting
- schema/input validation and request-size limits
- authentication/authorization with least privilege
- CSRF controls where cookie authentication is used
- secrets outside frontend code/repository
- audit IDs and idempotency for external side effects
- WAF/rate-limit exceptions tested explicitly
- abuse, injection, SSRF, access-control and replay tests

## Operational posture

Cloudflare DDoS protection remains part of the edge architecture. Permanent weekly edge audit and source security CI provide drift detection. Avoid permanent Under Attack mode or broad bot challenges without evidence because they can break legitimate APIs, platform reviewers, crawlers, and future integrations.

## Current decision

- Edge transport and browser headers: **PASS / LIVE**
- Static source security gate: **PASS on hardening branch**
- Immutable Actions in canonical repo: **PASS on hardening branch**
- Immutable checkout in root Pages sync: **PASS / LIVE**
- Cloudflare Free Managed WAF: **PENDING PERMISSION**
- Canonical branch protection: **PENDING ADMIN CONTROL**
- Root Pages branch protection: **PENDING ADMIN CONTROL**

Production security is materially stronger, but `SECURITY_FULLY_CLOSED=NO` until repository governance and the optional Free Managed WAF gate are resolved.