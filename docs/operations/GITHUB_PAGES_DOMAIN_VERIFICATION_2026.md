# GitHub Pages Domain Verification Runbook - 2026

## Current production stance

`jadeltechrd.com` is publicly served through Cloudflare as the DNS/TLS edge. The static origin is the root Pages repository `jadeldiaz01-png/jadeldiaz01-png.github.io`, published with GitHub Actions Pages workflow artifacts and immutable `app.<sha>.js` assets.

This is the production source of truth:

- Public browser entrypoint: `https://jadeltechrd.com/`
- Static origin repository: `jadeldiaz01-png/jadeldiaz01-png.github.io`
- Canonical source repository: `jadeldiaz01-png/jadeltechrd.com`
- Public edge: Cloudflare proxied DNS and TLS
- Required live contracts: `Verify public site health`, `Governed intake live contract`, `Live add-agent regression`

## Evidence already required

- `https://jadeltechrd.com/` returns HTTP 200 over HTTPS.
- `https://jadeltechrd.com/?view=privacy` returns HTTP 200 over HTTPS.
- `https://jadeltechrd.com/?view=terms` returns HTTP 200 over HTTPS.
- `https://jadeltechrd.com/solicitar-proyecto.html` returns HTTP 200 over HTTPS.
- `https://intake.jadeltechrd.com/health` returns HTTP 200 over HTTPS.
- The homepage loads an immutable `/app.<40-hex-sha>.js` asset.
- The immutable app asset contains `governedIntakeUrl` and does not contain `const directCheckout =`.

## GitHub Pages custom-domain verification

GitHub domain verification is an account-level anti-takeover control. It is separate from Cloudflare TLS health and from repository branch protection.

For the personal account `jadeldiaz01-png`, verify the apex domain from GitHub profile settings:

1. GitHub profile menu -> Settings.
2. Pages.
3. Add domain: `jadeltechrd.com`.
4. GitHub will display a TXT record value.
5. Add that TXT record in Cloudflare DNS:
   - Type: `TXT`
   - Name: `_github-pages-challenge-jadeldiaz01-png.jadeltechrd.com`
   - Value: the exact token GitHub displays.
   - Proxy: DNS-only, because TXT records are not proxied.
6. Confirm DNS propagation:

```bash
dig _github-pages-challenge-jadeldiaz01-png.jadeltechrd.com TXT +short
```

7. Return to GitHub profile Settings -> Pages and click Verify.
8. Keep the TXT record permanently so verification remains valid.

## Repository custom-domain setting

When the root Pages repository publishes through GitHub Actions, GitHub documents that the `CNAME` file in the artifact is ignored and is not required for custom domains. The effective custom-domain setting is controlled from repository Pages settings or the Pages REST API.

Because Cloudflare is the declared public edge, production is considered available when public HTTPS/live contracts pass. GitHub `https_enforced` can remain `false` while Cloudflare terminates and enforces HTTPS, but this must be tracked as an accepted edge-ownership decision, not as a hidden unknown.

## Cross-repository audit token

The canonical repository `jadeldiaz01-png/jadeltechrd.com` audits the root Pages repository `jadeldiaz01-png/jadeldiaz01-png.github.io`. Add a fine-grained GitHub token as repository secret `PAGES_AUDIT_TOKEN` with read-only access sufficient to call the Pages REST API for the root repository.

Without this secret, the readiness workflow can still validate public Cloudflare HTTPS and immutable app assets, but the root Pages API check will fail with `ROOT_PAGES_API=ACTION_REQUIRED`.

## Fail-closed controls

- Do not move `jadeltechrd.com` custom-domain ownership to the canonical repository.
- Do not merge PRs that remove Cloudflare edge checks from public health workflows.
- Do not give `PAGES_AUDIT_TOKEN` write, administration or workflow permissions.
- Do not add wildcard DNS records for `*.jadeltechrd.com`.
- Do not enable autonomous agent external side effects from Pages state alone.
- Do not infer payment fulfillment from PayPal links without backend ledger/reconciliation evidence.

## Promotion gate

Mark GitHub Pages domain hardening complete only when:

- GitHub profile Pages domain verification is `verified`.
- TXT record `_github-pages-challenge-jadeldiaz01-png.jadeltechrd.com` exists in public DNS.
- Repository secret `PAGES_AUDIT_TOKEN` exists with read-only Pages API access to the root Pages repository.
- Root repository Pages `build_type` is `workflow`.
- Public site health, governed intake live contract and live add-agent regression are green.
- Cloudflare edge DNS and HTTPS checks are green.
