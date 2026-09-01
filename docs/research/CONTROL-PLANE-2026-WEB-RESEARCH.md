# Control-plane web research — 2026-09-01

This note records implementation-relevant findings from current vendor documentation. It is intentionally descriptive; repository readiness still requires local and live evidence.

## Cloudflare

- Turnstile requires server-side Siteverify. CSP must allow `https://challenges.cloudflare.com` in `script-src` and `frame-src`; nonce-based CSP3 with `strict-dynamic` is recommended where practical.
- Workers observability provides invocation logs, custom logs, errors and uncaught exceptions. OpenTelemetry export is a supported path for third-party telemetry.
- Workers metrics expose request and workload behavior; Analytics Engine is suitable for high-cardinality aggregated service-health and usage events, with non-blocking writes.

## Open Policy Agent

- OPA should be located close to policy enforcement points when low latency and local reliability matter.
- Bundles are the standard policy/data distribution unit and can be digitally signed. Bundle state should participate in health/readiness.
- Decision logs provide `decision_id`, trace identifiers, queried policy and bundle metadata for audit/debugging. Sensitive data should be masked before export.

## OpenBao

- Audit is not enabled automatically after initialization and must be configured deliberately.
- OpenBao treats audit delivery as security-critical: if no enabled audit device can record a request, requests are not completed. Audit-device topology therefore needs HA and failure testing rather than a single fragile network sink.

## OpenTelemetry

- The Collector gateway pattern provides a stable OTLP endpoint and centralized processing/export. For tail sampling at scale, use a two-tier topology so all spans for a trace reach the same second-tier Collector.

## Repository consequences

1. Keep policy enforcement deny-by-default and require `verified_runtime` for external side effects.
2. Add signed OPA bundles plus decision-log correlation with application trace IDs.
3. Provision OpenBao with multiple reliable audit sinks and workload identity; do not rely on static root/service tokens.
4. Keep PII out of default telemetry. Export SLO signals through an OTLP gateway and use Workers native logs/metrics for edge diagnostics.
5. Add Analytics Engine only for aggregate operational metrics or usage analytics, never as an exact financial ledger.
6. Platform certification must remain evidence-based: adapter existence or `integration_ready` is insufficient for live side effects.
