# Control-plane implementation order

1. Close the governed-intake freeze with a green real-browser E2E.
2. Move governed CTA ownership into `app.js` and remove the bridge.
3. Re-run unit, contract, browser and live intake tests.
4. Begin platform-by-platform certification against `config/platform-registry.json`.
5. Provision live OpenBao/OPA only after workload identity, signed-bundle, audit, backup/restore and failure tests are ready.
6. Wire operational SLI/SLO telemetry to Cloudflare native observability plus the OpenTelemetry gateway.
7. Add signed supply-chain evidence and release/deployment attestations.
8. Promote individual platforms only from measured evidence; keep external side effects fail-closed until `verified_runtime` and applicable human approval.

This sequence deliberately avoids adding more autonomy before the intake and policy foundations are deterministic.