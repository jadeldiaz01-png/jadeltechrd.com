# ConoHa VPS runtime connector and GitHub runner bootstrap

## Objective

Register a repository-scoped GitHub Actions self-hosted runner named `jadel-agent-runtime` on an existing ConoHa VPS, require the labels `self-hosted`, `linux`, `x64`, and `jadel-agent-runtime`, and verify the runner is `online` and not busy before the production deployment workflow is allowed to consume it.

This repository also declares ConoHa's official remote HTTP MCP endpoint in `.mcp.json`:

- `https://api.conoha.jp/vps/mcp`

The MCP endpoint manages ConoHa infrastructure. It is deliberately not treated as a shell-execution channel. Host bootstrap remains a separate SSH trust domain.

## Required GitHub environment

Create or use the protected environment `production-bootstrap` and provide these secrets:

- `VPS_HOST`: public IP address or DNS name of the ConoHa VPS.
- `VPS_USER`: non-root SSH account with passwordless `sudo` only for the bootstrap operations required by this host.
- `VPS_SSH_PORT`: SSH port. Optional; defaults to 22.
- `VPS_SSH_PRIVATE_KEY`: Ed25519 private key dedicated to bootstrap access.
- `VPS_SSH_KNOWN_HOSTS`: pre-verified OpenSSH `known_hosts` entry for the exact VPS host/key. Do not populate this with an unverified `ssh-keyscan` result inside CI.
- `RUNNER_ADMIN_TOKEN`: fine-grained GitHub credential able to create repository runner registration tokens and read repository self-hosted runners. Keep it only in the protected environment.

Do not commit ConoHa API passwords, Keystone tokens, GitHub registration tokens, SSH private keys, or PATs to the repository.

## Execution

Run **Bootstrap ConoHa GitHub Runner** with confirmation:

`REGISTER_JADEL_AGENT_RUNTIME`

The workflow:

1. fails closed if required secrets are absent;
2. establishes strict SSH trust using a pinned host-key record;
3. requests a short-lived GitHub runner registration token;
4. asks GitHub for the current Linux x64 runner artifact and its SHA-256 checksum;
5. transfers the repository-controlled bootstrap script over SSH;
6. verifies the downloaded runner archive against GitHub's checksum;
7. configures `jadel-agent-runtime` with its custom label;
8. installs and starts the GitHub runner as a service;
9. queries GitHub until the runner is `online`, `busy=false`, and all required labels are present;
10. emits `RUNNER_READY=PASS` only when the complete gate is satisfied.

## Production continuation gate

Only after `RUNNER_READY=PASS` should `agent-fleet-deploy.yml` be dispatched for the exact approved `main` SHA. That workflow is responsible for host preflight, governed fleet bootstrap, persistent systemd lifecycle, watchdog activation, and post-deployment health checks.

Expected final evidence from the two-stage chain includes:

- `RUNNER_ONLINE=PASS`
- `RUNNER_IDLE=PASS`
- `RUNNER_LABELS=PASS`
- `RUNNER_READY=PASS`
- `JADEL_AGENT_FLEET_SYSTEMD=PASS`
- `JADEL_AGENT_FLEET_WATCHDOG_TIMER=PASS`
- `JADEL_AGENT_FLEET_DEPLOYMENT=PASS`

A visual website badge must not be promoted to an operational `ONLINE` claim from repository state alone. The later Cloudflare ingress increment should consume authenticated runtime health evidence and fail closed when the origin/runtime is unavailable.

## New-VPS alternative

For a newly created ConoHa VPS, ConoHa also provides an official GitHub Actions self-hosted-runner startup-script template. Prefer that route when provisioning a disposable/new host. For an already running production VPS, this repository's explicit SSH bootstrap provides an auditable, checksum-verified and idempotent path without rebuilding the server.
