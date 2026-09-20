# GA4 Activation Gate — Jadel Tech RD

Status: **ACTIVE**

This gate prepares GA4 without fabricating a property, stream, Measurement ID or verification result.

## Account-side target

Before creating anything, inspect the authorized Google Analytics account for an existing property and web stream for `https://jadeltechrd.com/`.

If no suitable property exists and the connected account has Editor-or-higher access, create:

- Property target: **Jadel Tech RD**
- Reporting timezone: **America/Santo_Domingo**
- Reporting currency: **USD**
- Web stream target: **jadeltechrd.com Web**
- URL: **https://jadeltechrd.com/**

The Measurement ID has now been confirmed from the GA4 installation instructions supplied by the account owner: `G-K60SQ2ZHL9`. The loader remains disabled until consent/CSP and Realtime/DebugView validation are complete.

## Verified GA4 identifier hierarchy

The identifiers are intentionally different because they refer to different GA4 resource levels:

- Windsor GA4 property selector / GA4 Property ID: `555066228` (**Jadel Tech RD**)
- Web Stream ID: `15812262707`
- Measurement ID: `G-K60SQ2ZHL9`
- Google Analytics Account ID: not independently verified yet

Google models a web stream as `properties/{property_id}/dataStreams/{stream_id}`, so Property ID and Stream ID must not be treated as interchangeable. Windsor's GA4 connector uses the selected property's ID in its `accounts` selector; a live test accepted `555066228` and rejected `15812262707` as an unavailable account/property selector.

## Privacy-by-default

`ga4-loader.js` does not load Google's remote tag until both conditions are true:

1. a real Measurement ID is configured and enabled;
2. an explicit analytics-consent grant invokes `JadelGA4.grantAnalyticsConsent()`.

Defaults:

- analytics_storage = denied
- ad_storage = denied
- ad_user_data = denied
- ad_personalization = denied

No ad storage or ad personalization is enabled by this gate.

## Browser event contract

Allowed:

- page_view
- offer_view
- offer_cta_click
- intake_start
- generate_lead

Allowed parameters are limited to offer/service/landing/CTA/UTM metadata.

Browser analytics must never include names, emails, phones, company free text, notes, messages, payment identifiers, Turnstile tokens or idempotency keys.

## Downstream lead lifecycle

`working_lead`, `qualify_lead`, `disqualify_lead`, `close_convert_lead`, and `close_unconvert_lead` remain server/CRM-side facts. They are not asserted by the public browser.

If Google Ads is authorized later, 2026 offline/enhanced lead uploads must use the current Data Manager API path, not a legacy browser shortcut.

## Activation evidence required

The GA4 core activation gate is now satisfied. The following evidence is recorded:

- account/property/stream are confirmed from the GA4 installation flow;
- Editor-or-higher access is still to be confirmed;
- the real Measurement ID `G-K60SQ2ZHL9` is recorded;
- consent UI is verified;
- minimum CSP changes are reviewed;
- Realtime and DebugView show the expected non-PII events;
- `generate_lead` is observed only after successful intake;
- paid acquisition remains unauthorized and max unapproved spend remains USD 0.

## Production separation

This work does not alter the Sep-21 → Oct-20 public SLO evidence policy and does not authorize agents, external publishing, trading, financial capital or ad spend.


## Live transport evidence

On 2026-09-20, a clean headless Chrome session from GitHub Actions opened the public production site, granted analytics consent and verified the browser-to-Google transport chain:

- Google tag request: HTTP 200
- Measurement ID: `G-K60SQ2ZHL9`
- GA4 `g/collect` request: HTTP 204
- Event: `page_view`
- Consent: granted for analytics; advertising storage/user-data/personalization remained denied
- Cloudflare response-header CSP was the blocking root cause and was corrected in the existing rule **Jadel Tech RD hardened browser response headers**
- Realtime and DebugView UI confirmation are now independently verified. DebugView evidence shows `page_view`, `session_start`, and `user_engagement`; `non_personalized_ads=1` is consistent with advertising personalization remaining disabled.

After transport verification, production configuration exits debug mode. The loader omits the `debug_mode` parameter entirely when disabled, as required by Google Analytics.
