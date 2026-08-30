# Jadel Tech RD — P1 Security Controls 2026-08-30

## Decision

P0 default-branch governance is closed on both public-serving repositories. P1 focuses on coordinated vulnerability reporting, signature posture, ruleset drift detection, and pre-authorized security requirements for any future dynamic endpoint.

## Quantitative prioritization

| Control | Attack surface reduced | Current implementation | Residual risk |
|---|---|---|---|
| Private vulnerability reporting | Public disclosure / delayed coordinated remediation | `SECURITY.md` policy prepared | GitHub feature enablement must be administratively verified |
| Ruleset drift monitoring | Silent weakening of branch protections | Weekly fail-closed audit | Alert delivery depends on GitHub Actions notifications |
| Protected-head signature audit | Unsigned protected-branch tip | Weekly + every canonical `main` push | Detection, not pre-merge signature enforcement |
| Dynamic-surface security gate | Future API/form/login abuse classes | Fail-closed CI contract | Becomes applicable when a dynamic surface is introduced |
| Cloudflare edge / WAF drift | TLS/WAF/header regression | Existing fail-closed audit | No material open P0 at current static edge |

## Private vulnerability reporting

GitHub Private Vulnerability Reporting is the preferred channel because it keeps vulnerability reports private and can transition accepted reports into repository security advisories for coordinated remediation.

The repository security policy now directs reporters to the GitHub private reporting flow when enabled and explicitly prohibits public disclosure of exploit details or secrets.

**Administrative gate:** the connected GitHub toolset does not expose the repository setting used to enable/disable Private Vulnerability Reporting. Therefore the feature must be enabled and then independently verified before it is marked `PASS`.

Target evidence:

- repository is public;
- Private Vulnerability Reporting enabled;
- `Report a vulnerability` available under Security and quality → Advisories;
- administrators receive security notifications;
- no invented email/security.txt contact is published.

## Ruleset drift monitoring

`.github/workflows/branch-governance-audit.yml` now checks both production-serving repositories for:

- exact expected ruleset name;
- active enforcement;
- `~DEFAULT_BRANCH` targeting;
- pull-request requirement;
- required status checks;
- strict up-to-date status policy;
- linear history;
- deletion restriction;
- non-fast-forward/force-push restriction;
- review-thread resolution;
- empty bypass actor list.

A missing or weakened invariant fails the workflow.

## Commit signature posture

`.github/workflows/commit-signature-audit.yml` verifies that the current `main` commit of both public-serving repositories has a GitHub `verification.verified=true` status.

This is intentionally a **post-merge drift detector**, not a substitute for GitHub's `required_signatures` ruleset rule. Full pre-merge signature enforcement is not activated yet because the root publication architecture may eventually use a GitHub App-generated PR, and every permitted automation identity must first be proven capable of producing commits that satisfy GitHub signature verification without deadlocking publication.

Promotion gate for `required_signatures`:

1. select final automation identity (prefer GitHub App installation token);
2. produce a real root synchronization PR;
3. verify the commit(s) that would land on protected `main` are signed/verified under the intended merge method;
4. repeat after token rotation;
5. only then add `required_signatures` to both active rulesets.

## Future dynamic attack surface

`.github/workflows/future-dynamic-surface-security.yml` detects common indicators of a new dynamic public surface, including forms, `/api/`, fetch/WebSocket code, server/backend directories, Workers and serverless functions.

If detected, CI requires `security/api-security-manifest.json` and evidence paths for injection, SSRF, replay and access-control tests. The manifest must attest controls for Turnstile on abuse-prone anonymous forms, endpoint rate limits, schema validation, request-size limits, authentication/authorization review, CSRF review, server-side secrets, idempotency, audit IDs and SSRF/egress policy.

The detailed contract is in `docs/security/FUTURE-DYNAMIC-SURFACE-SECURITY-CONTRACT.md`.

## Current P1 state

- ruleset drift audit: **IMPLEMENTED**
- protected-head signature audit: **IMPLEMENTED**
- future dynamic-surface security gate: **IMPLEMENTED**
- vulnerability reporting policy: **IMPLEMENTED**
- GitHub Private Vulnerability Reporting setting: **PENDING ADMIN VERIFICATION**
- mandatory signed-commit ruleset enforcement: **STAGED / NOT YET SAFE TO ACTIVATE**

`P1_SECURITY_AUTOMATION=PASS`
`P1_PRIVATE_REPORTING=PARTIAL`
`P1_REQUIRED_SIGNATURES=STAGED`
