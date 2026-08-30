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
| No managed WAF phase deployment was visible in the initial audit | Medium/Low for current static site | Free Managed Ruleset adds exploit-pattern defense; current site has low server-side attack surface. |
| No dedicated private security-reporting channel verified | Low | Responsible disclosure path should be formalized before a public security.txt is advertised. |

## Implemented controls

### Cloudflare edge — PASS / LIVE

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

A response-header Transform Rule emits:

- `Content-Security-Policy` with deny-by-default policy, same-origin script/style/font/connect, no plugins, no base URI, no framing, and HTTPS upgrade
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- restrictive `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

The permanent Cloudflare drift auditor is fail-closed. Run `33316965872` verified TLS 1.2 minimum, TLS 1.3, Always HTTPS, Automatic HTTPS Rewrites, Browser Integrity Check, security level, HSTS invariants, HTTP-to-HTTPS redirect, the managed WAF execute rule, and all required public security headers.

### Cloudflare Free Managed WAF — PASS / LIVE

Cloudflare's official documentation identifies the **Cloudflare Free Managed Ruleset** as available on every Cloudflare plan and publishes the ruleset ID `77454fe2d30c4220b5701f6fdfb893ba`.

The WAF reconciler uses zone-level access, the documented Free Managed Ruleset ID, deploys it idempotently in the `http_request_firewall_managed` phase, verifies the active execute rule, and performs post-change public health checks.

Verified production execution:

- workflow run: `33316670808`
- job: `99271274056`
- `CLOUDFLARE_ZONE_ACCESS=PASS`
- `FREE_MANAGED_WAF_DEPLOY=PASS`
- `FREE_MANAGED_WAF_VERIFY=PASS`
- homepage/privacy/terms/data-deletion: HTTP 200
- `POST_WAF_SITE_HEALTH=PASS`

### Source/browser security — PASS / MERGED

The canonical homepage includes a restrictive CSP meta policy and strict referrer policy as defense in depth. Permanent `security-ci.yml`:

- rejects missing CSP controls
- rejects inline event handlers
- rejects `eval`, `new Function`, and `document.write`
- rejects insecure `http://` resource references
- requires every external GitHub Action to use a full 40-character commit SHA
- performs a Chrome headless smoke test under CSP

### GitHub Actions supply chain — PASS / MERGED

Pinned canonical Actions include:

- `actions/checkout` → `11d5960a326750d5838078e36cf38b85af677262`
- `actions/configure-pages` → `983d7736d9b0ae728b81ab479565c72886d7745b`
- `actions/upload-pages-artifact` → `56afc609e74202658d3ffba0e8f6dda462b719fa`
- `actions/deploy-pages` → `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`

The root Pages validation and synchronization workflows also use immutable checkout SHAs.

### Canonical repository ruleset — PASS / ACTIVE

GitHub repository ruleset ID `21863034`, `Jadel Tech RD canonical main protection`, is active and targets `~DEFAULT_BRANCH`.

Verified rules:

- pull request required
- `security-baseline` required status check
- strict required-status-check policy
- review-thread resolution
- linear history
- deletion restricted
- non-fast-forward / force-push restricted
- `bypass_actors=[]`
- connected actor reports `current_user_can_bypass=never`

GitHub branch metadata now reports `protected=true`; legacy branch-protection fields remain separate and are not the authority for this ruleset.

### Root Pages publication architecture — PASS / PR-BASED

Root PR #1 migrated `.github/workflows/sync-public-site.yml` away from direct pushes to `main`.

The new workflow:

- synchronizes only on an isolated `automation/canonical-site-sync` branch
- validates canonical assets before committing
- creates/updates a PR when the configured PR credential permits it
- never publishes synchronized content directly to protected `main`
- preserves production unchanged if PR creation is blocked
- runs hourly and can be manually dispatched
- uses concurrency to avoid overlapping synchronization runs

`root-public-site-validation` passed on PR #1 exact head SHA `d9e936a8efc6d558d2786f91d72ae7b0515c37b8`. PR #1 was squash-merged as `f43dbb589b33f1be1df3c03073b885b81bdd4fb5`. The first execution of the new sync workflow completed successfully and detected no canonical drift.

This removes the previous architectural reason that a root ruleset would necessarily break publication.

## Residual risks / required governance

### P0 — Root Pages ruleset activation

The canonical repository is protected. The remaining default-branch governance gate is the root Pages repository.

`docs/security/rulesets/root-pages-main-protection.json` is prepared with:

- PR requirement
- `root-public-site-validation` required status check
- strict up-to-date check policy
- linear history
- deletion restriction
- non-fast-forward / force-push restriction
- no bypass actors

Importing that ruleset requires repository administrative action. After activation, verify it through GitHub REST and perform a controlled PR-based publication test.

For autonomous PR creation, the preferred identity is a least-privilege GitHub App installation token. A fine-grained PAT is a secondary option. `GITHUB_TOKEN` can safely publish the synchronization branch but GitHub repository settings may restrict workflow-created PRs or subsequent PR workflow execution; therefore do not weaken branch rules to accommodate token limitations.

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
- Cloudflare Free Managed WAF: **PASS / LIVE**
- Cloudflare fail-closed drift audit: **PASS**
- Static source security gate: **PASS / MERGED / DEPLOYED**
- Immutable Actions in canonical repo: **PASS / MERGED**
- Canonical branch protection/ruleset: **PASS / ACTIVE**
- Root synchronization security baseline: **PASS**
- Root publication architecture: **PASS / PR-BASED**
- Root Pages branch protection/ruleset: **PENDING ADMIN ACTIVATION**

Production security is materially stronger. `SECURITY_FULLY_CLOSED=NO` only because the root Pages default-branch ruleset still requires administrative activation and post-activation verification.
