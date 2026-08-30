# Jadel Tech RD — Repository ruleset activation

## Objective

Protect both public-serving default branches against unreviewed changes, force pushes, deletion, and CI bypass while preserving a working publication path.

## Canonical repository

Repository: `jadeldiaz01-png/jadeltechrd.com`

`canonical-main-protection.json` is now imported and active as repository ruleset ID `21863034`.

Verified controls:

- target: `~DEFAULT_BRANCH`
- enforcement: `active`
- pull request required before merge
- `security-baseline` required status check
- strict up-to-date status-check policy
- review-thread resolution
- linear history
- branch deletion restriction
- non-fast-forward / force-push restriction
- bypass actors: none
- current connected actor cannot bypass the ruleset

The approving-review count is intentionally `0` because the repository currently has a single administrative owner; the PR and deterministic security check remain mandatory without creating a self-review deadlock. Increase the approval count when an independent reviewer is available.

## Root Pages repository

Repository: `jadeldiaz01-png/jadeldiaz01-png.github.io`

The publication architecture has been migrated away from direct pushes to `main`.

`sync-public-site.yml` now:

- prepares an isolated branch named `automation/canonical-site-sync`
- fetches and validates canonical public assets
- never commits synchronized site changes directly to `main`
- publishes the isolated branch when drift exists
- opens or updates a pull request when the configured PR credential is permitted
- preserves production unchanged if PR creation is blocked
- runs hourly plus on manual dispatch

A permanent required check named `root-public-site-validation` validates CSP, referrer policy, prohibited JavaScript primitives, insecure HTTP resource references, JavaScript syntax, required public files, and the expected custom-domain CNAME.

The migration itself was reviewed through root PR #1. `root-public-site-validation` passed on exact head SHA `d9e936a8efc6d558d2786f91d72ae7b0515c37b8`; PR #1 was then squash-merged as `f43dbb589b33f1be1df3c03073b885b81bdd4fb5`. The first execution of the new sync workflow completed successfully and detected no canonical drift.

`root-pages-main-protection.json` is now the active-ready recipe. Import it only after confirming the repository's desired PR-creation identity. The safest autonomous target is a least-privilege GitHub App installation token. A fine-grained PAT can also work but has greater user-lifecycle and rotation coupling. `GITHUB_TOKEN` remains a safe fallback for branch publication, but GitHub may restrict workflow-created PRs or their subsequent workflow execution depending on repository Actions settings.

Never use a broad repository-admin bypass simply to keep publication working.

## Validation after root activation

After importing `root-pages-main-protection.json`, confirm through `GET /repos/jadeldiaz01-png/jadeldiaz01-png.github.io/rulesets` that an `active` ruleset exists, targets `~DEFAULT_BRANCH`, and contains:

- `pull_request`
- `required_status_checks` with `root-public-site-validation`
- `required_linear_history`
- `deletion`
- `non_fast_forward`
- zero broad bypass actors

Then perform a controlled PR-based publication test from a disposable synchronization change. Do not test deletion or force-push against production `main`.

## Signed commits

Signed-commit enforcement is deliberately not part of the initial recipes. Existing automation-generated commits are not consistently signed. Add this rule only after every permitted automation identity can produce verifiable commits; otherwise the control can deadlock deployment.
