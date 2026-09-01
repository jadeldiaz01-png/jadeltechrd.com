# Governed intake freeze incident — 2026-09-01

## Status

The production live-contract browser check reproduced a main-thread/CDP timeout while exercising the configurator. Public assets, `/health`, exact-origin CORS and Turnstile public configuration passed before the browser step failed.

## Working hypothesis

The compatibility bridge was observing `#selected-services` while `app.js` reconstructs that subtree with `innerHTML`. Even after narrowing the observer, this created unnecessary mutation-driven synchronization on the same UI state that `app.js` owns.

## Containment

The bridge no longer uses `MutationObserver`. It synchronizes only after explicit add/remove clicks, coalesced through a microtask. Navigation remains fail-closed and the bridge remains a temporary compatibility shim.

## Exit criteria

This incident is not closed until all of the following hold:

1. the real-browser live contract passes on the deployed main branch;
2. the CTA resolves to `/solicitar-proyecto.html?services=...` and never to `mailto:` or direct checkout;
3. `app.js` becomes the sole owner of configurator state and governed intake routing;
4. `project-intake-bridge.js` is removed from the production page and repository after a green replacement E2E;
5. the intake form, Turnstile, API CORS, D1 persistence, evidence/outbox and policy/HITL path remain green.

No payment, publication, trading, credential or other critical side effect is authorized by this hotfix.