# Jadel Tech RD — Repository ruleset activation

## Objective

Protect both public-serving default branches against unreviewed changes, force pushes, deletion, and CI bypass while preserving a working publication path.

## Canonical repository

Repository: `jadeldiaz01-png/jadeltechrd.com`

Import `canonical-main-protection.json` through GitHub **Settings → Rules → Rulesets → New ruleset → Import a ruleset**.

The recipe targets only the default branch and requires:

- pull request before merge
- `security-baseline` required status check
- branch up to date before merge
- review-thread resolution
- linear history
- branch deletion restriction
- non-fast-forward / force-push restriction
- no bypass actors

The approving-review count is intentionally `0` because the repository currently has a single administrative owner; the PR and deterministic security check remain mandatory without creating a self-review deadlock. Increase the approval count when an independent reviewer is available.

## Root Pages repository

Repository: `jadeldiaz01-png/jadeldiaz01-png.github.io`

The file `root-pages-main-protection.disabled.json` is intentionally imported with enforcement **disabled** until publication no longer depends on an unrestricted direct push from `sync-public-site.yml`.

A permanent check named `root-public-site-validation` is already installed in the root repository. It validates CSP, referrer policy, prohibited JavaScript primitives, insecure HTTP resource references, JavaScript syntax, required public files, and the expected custom-domain CNAME.

Do **not** switch the root recipe to Active until one of these is implemented and tested:

1. an audited GitHub App bypass actor restricted to the synchronization job; or
2. a PR-based synchronization workflow using an identity that can create a PR, trigger required checks, and merge only after those checks succeed.

Never use a broad repository-admin bypass simply to keep publication working.

## Validation after activation

After importing a ruleset, confirm through the GitHub REST `GET /repos/{owner}/{repo}/rulesets` endpoint that an `active` ruleset exists, targets `~DEFAULT_BRANCH`, and contains the expected rule types. Then perform a controlled negative test from a disposable branch/PR; do not test branch deletion or force-push against production `main`.

## Signed commits

Signed-commit enforcement is deliberately not part of the initial recipes. Existing automation-generated commits are not consistently signed. Add this rule only after every permitted automation identity can produce verifiable commits; otherwise the control can deadlock deployment.
