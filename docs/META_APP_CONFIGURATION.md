# Meta App public URL configuration

Status date: 2026-08-28

## Public URLs

Use the following values in the application configuration:

| Field | URL |
| --- | --- |
| App homepage / application website | `https://jadeltechrd.com/` |
| Privacy Policy URL | `https://jadeltechrd.com/?view=privacy` |
| Terms of Service URL | `https://jadeltechrd.com/?view=terms` |
| Data Deletion Instructions URL | `https://jadeltechrd.com/?view=data-deletion` |

The machine-readable source of truth is `config/meta-app-links.json`.

## Governance rules

1. All URLs must be public over HTTPS and must remain accessible without authentication.
2. The legal text must describe actual application behavior. Do not claim data handling practices that are not implemented.
3. A privacy contact email must not be invented. Add it only after a real mailbox exists and has been tested.
4. If scopes, providers, retention behavior or data flows change, review Privacy Policy and Terms before production promotion.
5. Data deletion requests must never be accepted through public GitHub issues because they can expose personal information.
6. Do not mark compliance readiness PASS until the public URLs are reachable from the Internet and the custom domain has valid HTTPS.

## Current blocker: GitHub Pages not enabled

The deployment workflow exists at `.github/workflows/pages.yml`, but the first deployment failed at `actions/configure-pages` because GitHub Pages has not yet been enabled/configured for the repository.

Required repository setting:

- Repository -> Settings -> Pages
- Build and deployment -> Source -> GitHub Actions
- Custom domain -> `jadeltechrd.com`
- Enable HTTPS after DNS/domain verification permits it

After enabling Pages, rerun `Deploy public site to GitHub Pages`.

## Privacy contact gate

Current state: `PENDING`.

Before application review/production, create and verify a real mailbox intended for privacy/data-deletion requests. Examples of naming conventions are `privacy@...` or `support@...`, but no address is authorized by this document until the mailbox actually exists and has been tested.

Once available:

1. Add it to the Privacy Policy contact section.
2. Add it to the Data Deletion Instructions page.
3. Set `privacy_contact_email` in `config/meta-app-links.json`.
4. Send a test message and verify receipt before marking the contact gate PASS.

## Production gate

`META_PUBLIC_APP_INFORMATION_READY = PASS` only when all of the following are true:

- homepage reachable over HTTPS;
- privacy policy reachable over HTTPS;
- terms reachable over HTTPS;
- data deletion instructions reachable over HTTPS;
- custom domain verified;
- real privacy contact configured and tested;
- legal content matches actual application behavior.

Until then the correct status is `PENDING`, not `READY`.
