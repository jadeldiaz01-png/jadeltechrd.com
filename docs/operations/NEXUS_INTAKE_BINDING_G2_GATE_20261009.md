# G2 — Nexus private intake binding and policy evidence (prepare-only)

## Source of finding

- Intake request `82555092-cd10-4487-a637-ea2b1915aeb2` was persisted with `POLICY_CHECK` / `REQUIRES_HUMAN`; outbox `DISPATCHED`, attempts 1.
- Read-only evidence runs: `38010236898` and `38015948161`.
- Worker production deploy run `37919220743` lists `PROJECT_WORKFLOW`, D1 and rate limit but does not list `NEXUS_POLICY`.
- Source code previously fell back to `NEXUS_POLICY_BINDING_MISSING` when the binding was absent. This is a likely cause, not a direct Cloudflare Workflow instance trace.

## Deployment boundary

The main deployment workflow remains **manual `workflow_dispatch` with an exact protected main SHA and human confirmation**.

The proposed deploy job requires **`vars.NEXUS_POLICY_SERVICE` in the approved `jadeltechrd` environment**, with the verified same-account Cloudflare Worker service name (not a URL, secret, free-text description, trading service or a guessed name).

The deployment job:
1. Validates a bounded lower-case Worker name and rejects self-binding.
2. Queries the Cloudflare account Workers Scripts content/v2 endpoint with GET to confirm the exact Worker exists; it does not invoke the policy endpoint or an order.
3. Generates a `services: [{binding:"NEXUS_POLICY",service:<certified-worker-name>}]` binding for the private caller.
4. Verifies the effective generated configuration locally before `wrangler deploy`.

If the variable is missing, the name invalid, the script GET forbidden, or the target absent, **deployment stops before Worker deploy**. The deployment workflow still performs D1 migration preparation in an earlier job, so a later production authorization must separately review the existing D1 mutation boundary before any manual dispatch.

## Required external evidence at the next human gate

- Authorized operator must identify and certify the exact production Cloudflare Worker name and account for Nexus. A GitHub repository name is **not** proof of a deployed Worker.
- Verify that the target implements the private `POST /v1/project-readiness` contract, returns only `ALLOW`, `DENY` or `REQUIRES_HUMAN`, and supplies a bounded `evidence_id` for every `ALLOW`.
- Confirm least-privilege permissions and data policy for project IDs and selected service IDs.
- Independently review the PR exact HEAD, test runs, service target, anti-abuse policy and rollout/rollback before any merge.
- A distinct approval is required for merge; a further distinct approval is required for any production workflow dispatch.
- Do **not** replay or approve existing user request `82555092-cd10-4487-a637-ea2b1915aeb2` to test integration.
- Do **not** rotate secrets, create external actions, authorize finances or turn on autonomous production.

## Evidence and safety semantics

`commercial-runtime/src/nexus-policy.mjs` writes one stable `NEXUS_POLICY_EVALUATED` record per project into the existing `evidence_events` D1 table. It contains a bounded decision, reason, optional evidence ID, and the `fail_closed` marker. The evidence insert and corresponding project status update are in a D1 batch; database write errors block the workflow step. An `ALLOW` without a valid evidence ID becomes `REQUIRES_HUMAN`, as do binding absence, network/HTTP failures and malformed responses.

Manual policy approval remains a separate authenticated `policy-approval` event, handled by the existing HITL route. Nexus policy evaluation never creates quotations, executes payments, deploys production code, publishes content, or places trading orders.

**Not solved by this PR:** Cloudflare instance inspection, Nexus service provisioning, secure production status UI, notifications, and end-to-end certification of classification/brief creation. Those require evidence and separate authorization.
