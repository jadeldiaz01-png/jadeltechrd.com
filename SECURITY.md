# Security Policy

## Report a vulnerability privately

Do **not** publish exploit details, credentials, API tokens, personal data, proof-of-concept material, or other sensitive evidence in public issues, pull requests, discussions, comments, or social media.

The preferred reporting mechanism is **GitHub Private Vulnerability Reporting** for this public repository when the feature is enabled. Use the repository's **Security and quality → Reporting → Advisories → Report a vulnerability** flow. Repository security advisories keep the report and remediation discussion private between the reporter and authorized maintainers.

If that GitHub control is unavailable, do not post technical details publicly. Use only a separately verified private Jadel Tech RD support/security contact published by the organization. Until a dedicated security contact is verified, this repository intentionally does not invent an email address or publish a `security.txt` contact that has not been validated.

## What to include

Provide the minimum information needed to reproduce and triage the issue safely:

- affected URL, component, workflow, commit or integration;
- vulnerability class and realistic impact;
- minimal reproduction steps;
- sanitized evidence or proof of concept;
- required preconditions;
- suggested mitigation, if known.

Do not include live credentials, unrelated personal data, destructive payloads, persistence mechanisms or secrets discovered during testing.

## Scope

Security reports may cover the public Jadel Tech RD website, deployment workflows, Cloudflare/GitHub Pages configuration, Jadel Tech RD-owned application code, and Jadel Tech RD-controlled integrations.

Third-party platforms, APIs, cloud providers and dependencies remain subject to their own security programs and terms unless the vulnerability is caused by Jadel Tech RD's integration or configuration.

## Safe reporting expectations

- Minimize collection of user or production data.
- Do not attempt persistence, destructive actions, denial of service, social engineering, credential theft or lateral movement.
- Stop testing if you encounter secrets, personal data or access beyond what is necessary to demonstrate the issue.
- Do not intentionally degrade availability or consume excessive resources.
- Provide reproducible evidence that does not expose sensitive data publicly.

## Coordinated remediation

Accepted vulnerabilities should be handled through a private GitHub security advisory when possible. High-impact fixes should use the existing protected-branch workflow, required CI checks and the minimum necessary private collaboration. Public disclosure should occur only after mitigation is available and exposure has been assessed.

## Security baseline

The public website uses layered controls including Cloudflare edge protection, HTTPS/TLS hardening, HSTS, browser security headers, restrictive Content Security Policy, Cloudflare Free Managed WAF, GitHub Actions supply-chain checks, protected default branches, required status checks and automated drift/security verification.

Future forms, APIs, login/session flows, webhooks, Workers or other dynamic attack surfaces are governed by `docs/security/FUTURE-DYNAMIC-SURFACE-SECURITY-CONTRACT.md` and the fail-closed `.github/workflows/future-dynamic-surface-security.yml` gate.

The detailed assessment and evidence are tracked under `docs/security/`.
