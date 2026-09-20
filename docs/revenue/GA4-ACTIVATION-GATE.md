# GA4 Activation Gate — Jadel Tech RD

Status: **BLOCKED_ACCOUNT_CONNECTION**

This gate prepares GA4 without fabricating a property, stream, Measurement ID or verification result.

## Account-side target

Before creating anything, inspect the authorized Google Analytics account for an existing property and web stream for `https://jadeltechrd.com/`.

If no suitable property exists and the connected account has Editor-or-higher access, create:

- Property target: **Jadel Tech RD**
- Reporting timezone: **America/Santo_Domingo**
- Reporting currency: **USD**
- Web stream target: **jadeltechrd.com Web**
- URL: **https://jadeltechrd.com/**

The Measurement ID must be copied from GA4 Admin > Data streams > Web stream details and must begin with `G-`.

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

The gate remains blocked until:

- account/property/stream are confirmed;
- Editor-or-higher access is confirmed;
- the real `G-` ID is recorded;
- consent UI is verified;
- minimum CSP changes are reviewed;
- Realtime and DebugView show the expected non-PII events;
- `generate_lead` is observed only after successful intake;
- paid acquisition remains unauthorized and max unapproved spend remains USD 0.

## Production separation

This work does not alter the Sep-21 → Oct-20 public SLO evidence policy and does not authorize agents, external publishing, trading, financial capital or ad spend.
