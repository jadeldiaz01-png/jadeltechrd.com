# VPS runtime connector and GitHub runner bootstrap over Tailscale

## Objective

Register the repository-scoped GitHub Actions self-hosted runner `jadel-agent-runtime`
on the existing VPS through the private Tailscale network. The cloud provider is
not part of the deployment control plane.

Required runner labels:

- `self-hosted`
- `linux`
- `x64`
- `jadel-agent-runtime`

The workflow verifies that the runner is `online` and `busy=false` before it
is considered ready.

## Network model

Operational access is:

```text
GitHub Actions
  -> ephemeral Tailscale identity (tag:github-deployer)
  -> tailnet policy
  -> VPS MagicDNS / 100.x address
  -> pinned SSH host identity
  -> least-privilege bootstrap helper
```

The VPS hosting provider is deliberately outside this path. No provider API,
provider MCP endpoint, or public-provider SSH address is required by the
bootstrap workflow.

## Required GitHub environment

Use the protected environment `production-bootstrap`.

Variables:

- `VPS_TAILSCALE_HOST`: MagicDNS name of the VPS.
- `VPS_TAILSCALE_IP`: Tailscale IPv4 address; must be in `100.x`.

Secrets:

- `TS_DEPLOYER_OAUTH_ID`
- `TS_DEPLOYER_AUDIENCE`
- `VPS_USER`
- `VPS_SSH_PRIVATE_KEY`
- `VPS_SSH_PRIVATE_KEY_PASSPHRASE`
- `VPS_TAILSCALE_SSH_KNOWN_HOSTS`
- `RUNNER_ADMIN_TOKEN`

Do not commit Tailscale credentials, GitHub registration tokens, SSH private
keys, or PATs.

## Execution

Run **Bootstrap VPS GitHub Runner over Tailscale** with:

- `expected_sha=<exact current main SHA>`
- `confirmation=REGISTER_JADEL_AGENT_RUNTIME_TAILSCALE`

The workflow:

1. binds execution to the exact authorized main SHA;
2. fails closed when required Tailscale/SSH inputs are absent;
3. joins the tailnet with the deployer identity;
4. verifies `tailscale ping` to the VPS;
5. verifies TCP/22 only through the Tailscale address;
6. establishes strict SSH trust with a pinned host-key record;
7. requests a short-lived GitHub runner registration token;
8. obtains the Linux x64 runner artifact and GitHub-published SHA-256;
9. registers/starts `jadel-agent-runtime` through the private path;
10. verifies the runner is online, idle and correctly labelled.

## Production continuation

Only after `RUNNER_READY=PASS` should a deployment workflow consume the
self-hosted runner for the exact approved SHA.

This migration does not delete or rebuild the VPS. It removes the hosting
provider from the operational automation boundary and makes Tailscale the
canonical private access path.
