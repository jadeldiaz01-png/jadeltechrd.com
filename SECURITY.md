# Security Policy

## Reporting a security issue

Please do not publish exploit details, credentials, API tokens, personal data, or other sensitive evidence in public issues, pull requests, discussions, or social media.

If GitHub Private Vulnerability Reporting is enabled for this repository, use that private reporting channel. Otherwise, use a verified private support/security channel published by Jadel Tech RD before sharing sensitive technical details.

Until a dedicated security contact is verified, this repository intentionally does not publish an email address or `security.txt` contact that has not been validated.

## Scope

Security reports may cover the public Jadel Tech RD website, deployment workflows, Cloudflare/GitHub Pages configuration, and Jadel Tech RD-owned application code or integrations.

Third-party platforms, APIs, cloud providers, and dependencies remain subject to their own security programs and terms.

## Safe reporting expectations

- Minimize collection of user or production data.
- Do not attempt persistence, destructive actions, denial of service, social engineering, credential theft, or lateral movement.
- Stop testing if you encounter secrets, personal data, or access beyond what is necessary to demonstrate the issue.
- Provide reproducible evidence that does not expose sensitive data publicly.

## Security baseline

The public website uses layered controls including Cloudflare edge protection, HTTPS/TLS hardening, HSTS, browser security headers, restrictive Content Security Policy, GitHub Actions supply-chain checks, and automated production health/security verification.

The detailed assessment and residual risks are tracked in `docs/security/SECURITY-ASSESSMENT-2026-08-30.md`.