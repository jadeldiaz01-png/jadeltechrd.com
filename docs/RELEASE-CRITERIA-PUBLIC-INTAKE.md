# Public intake release criteria

`PUBLIC_INTAKE_VERIFIED` may be asserted only when the deployed main revision satisfies all of the following:

- homepage and intake assets are reachable over HTTPS;
- configurator selection/update latency stays within the defined browser SLO;
- governed CTA resolves only to `/solicitar-proyecto.html?services=...`;
- no governed CTA path uses `mailto:` or direct payment;
- the intake page CSP permits only the required Turnstile/API origins;
- `/health`, public config, exact-origin CORS and preflight pass;
- server-side Turnstile validation enforces expected hostname and action;
- idempotency, D1 persistence, evidence event and transactional outbox are verified;
- workflow/policy handling is fail-closed and critical actions remain HITL;
- no unresolved production blocker exists for the intake platform.

A successful deploy without these checks is `DEPLOYED`, not `PUBLIC_INTAKE_VERIFIED`.