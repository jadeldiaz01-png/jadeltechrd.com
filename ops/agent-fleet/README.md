# Jadel Agent Fleet 24x7

Production execution plane behind `jadeltechrd.com`.

## Safety model

The website catalog is not treated as eleven equivalent autonomous daemons. The fleet registry distinguishes always-on services, supervised workers, connectors and research-only systems. External side effects are default-deny. Live capital, autonomous marketplace submissions and autonomous social publication remain disabled.

## Always-on runtime

- `control-plane`: authoritative health/status view for the fleet.
- `support-tickets`: container-qualified Streamlit support service.
- `aureus`: AUREUS API kept alive in fail-closed safe standby. `/health/live` may pass while `/health/ready` remains 503 until AUREUS' own readiness gates pass; the fleet must not reinterpret liveness as authorization.
- `chatbot`: container-qualified Jadel assistant. It uses only a server-side `OPENAI_API_KEY`, never requests a visitor credential, has no tools for external side effects, and is enabled only when the production host is configured with that secret. `OPENAI_MODEL` is configurable server-side.

CineForge/social publishing, Meta actions, revenue submissions and quantitative/live-capital operations remain supervised or research-only until their own evidence gates authorize promotion.

## Reliability controls

- Docker `restart: unless-stopped`.
- systemd starts the fleet after Docker/network recovery.
- a systemd timer runs a bounded watchdog every two minutes.
- the watchdog restarts only unhealthy runtime services and exits non-zero if recovery fails.
- health endpoints are bound to loopback by default; no service is exposed publicly by this bundle.
- source repositories are checked out at exact 40-character SHAs.
- the deployment workflow requires an exact approved SHA and a dedicated self-hosted runner label.

## Host contract

Expected production host:

- Linux x64, Ubuntu LTS recommended.
- Docker Engine + Docker Compose v2.
- `git`, `curl`, `rsync`, `systemd`.
- non-interactive sudo for the dedicated deployment runner only for the audited service-install operations.
- writable `/opt/jadel-agent-fleet` owned/managed for the runtime account.
- GitHub Actions runner labels: `self-hosted`, `linux`, `x64`, `jadel-agent-runtime`.

Do not expose Docker daemon TCP sockets or store SSH/private keys in the repository.

## Deployment

Use `.github/workflows/agent-fleet-deploy.yml` with:

- `expected_sha`: the exact protected `main` SHA.
- `confirmation`: `DEPLOY_JADEL_AGENT_FLEET`.

The workflow performs host preflight, clones every deployable source at its pinned SHA, builds containers, starts the safe fleet, installs systemd + watchdog, and performs post-deploy health checks.

## Secrets

Runtime secrets belong in GitHub Environment/Actions secrets or a host secret manager. Never commit them. `OPENAI_API_KEY` is only consumed if the chatbot is explicitly enabled. Never expose it to the browser or public status endpoint.

## Public website integration

Do not change the website badge to `ONLINE` based on repository state. Public status should be connected only after a protected ingress exists (for example Cloudflare Tunnel/reverse proxy) and the browser can fetch a deliberately public read-only status endpoint without exposing administrative endpoints. Until then, the static website and the private runtime are intentionally separated.

## Promotion rule

`24x7 READY` means the deployment bundle and its CI gates pass. `24x7 LIVE` requires evidence from a real host: self-hosted runner allocated, deployment workflow success, systemd active, watchdog active, all required health checks passing, and external reachability where intentionally exposed.
