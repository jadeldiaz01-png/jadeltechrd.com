# Jadel Tech RD — Root Pages Ruleset Verification 2026-08-30

## Decision

The root GitHub Pages repository `jadeldiaz01-png/jadeldiaz01-png.github.io` is now protected by an active repository ruleset.

Verified through GitHub REST:

- ruleset ID: `21863874`
- name: `Jadel Tech RD Pages root main protection`
- enforcement: `active`
- target: `branch`
- condition: `~DEFAULT_BRANCH`
- pull request required
- required status check: `root-public-site-validation`
- strict required-status-check policy enabled
- review-thread resolution required
- linear history required
- deletion restricted
- non-fast-forward / force-push restricted
- bypass actors: none
- connected actor bypass capability: `never`

GitHub branch metadata reports `main` as `protected=true`.

## Publication architecture

The root synchronization workflow was migrated before activating this ruleset. Canonical site changes are prepared on `automation/canonical-site-sync` and delivered through pull request rather than direct push to protected `main`. The permanent `root-public-site-validation` job remains the required merge gate.

This avoids weakening the ruleset for automation and preserves fail-closed publication behavior.

## Current security-governance status

- canonical repository ruleset: PASS / ACTIVE
- root Pages repository ruleset: PASS / ACTIVE
- canonical required check: `security-baseline`
- root required check: `root-public-site-validation`
- force-push on both protected default branches: DENIED by ruleset
- branch deletion on both protected default branches: DENIED by ruleset
- broad bypass actors: NONE

`DEFAULT_BRANCH_GOVERNANCE=PASS`

This verification supersedes any earlier assessment line that still described root Pages ruleset activation as pending.
