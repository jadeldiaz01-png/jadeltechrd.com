# Control-plane status — 2026-09-01

Merged foundation: Agent/Platform Registry, fail-closed OPA policy contract, OpenBao workload-identity/policy contract, SLO policy, PII-safe telemetry envelope and OTel gateway contract.

Open incident: deployed real-browser governed-intake E2E timed out while exercising the configurator. API health/CORS/Turnstile public config passed before the browser step. Current hotfix removes MutationObserver from the compatibility bridge and awaits protected PR + deployed E2E verification.

Human gate: the commercial runtime deployment workflow now expects PayPal/Admin production secrets that are not currently present in the GitHub Environment. No payment activation should be inferred until those credentials, webhook verification and reconciliation tests exist.

Next promotion: green browser E2E -> single-owner `app.js` intake routing -> remove bridge -> full public-intake verification -> platform-by-platform certification.