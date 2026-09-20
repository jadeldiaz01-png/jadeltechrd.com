# Analytics Control Plane v1

Status: **ACTIVE_WITH_GATED_EXPANSION**

## Verified production chain

The production browser path is now independently evidenced:

`browser -> explicit analytics consent -> gtag.js -> GA4 g/collect -> G-K60SQ2ZHL9 -> Stream 15812262707 -> Property 555066228`

Verified evidence:

- gtag.js HTTP 200
- GA4 g/collect HTTP 204
- `page_view` transported successfully
- GA4 Realtime screenshot shows 1 active user in the last 30 minutes
- Windsor.ai can read Property 555066228
- Google Ads remains unlinked and unapproved spend remains USD 0

DebugView UI evidence remains pending and is not inferred from Realtime.

## Robust architecture

### Tier 1 — Browser telemetry

Purpose: acquisition and behavior.

The browser remains consent-gated and cannot send PII. It is not the source of truth for lead qualification, sale state or payment state.

### Tier 2 — First-party commercial ledger

The intake/backend remains authoritative for lead lifecycle and revenue facts. GA4 is an analytics projection, not a commercial system of record.

### Tier 3 — Measurement Protocol, gated

Measurement Protocol is reserved for server-side lifecycle events such as `qualify_lead` and `close_convert_lead`.

It stays disabled until:
1. a Measurement Protocol API secret is created in GA4;
2. the secret is stored only in a server-side secret manager;
3. a privacy review approves the exact fields;
4. session attribution linkage using valid `client_id` / `session_id` is designed and tested.

The API secret must never be committed or exposed in browser JavaScript.

### Tier 4 — BigQuery Export, gated

Recommended next storage layer: GA4 -> BigQuery daily export.

Expected dataset after linking: `analytics_555066228`.

Start with **daily export**. Streaming remains disabled until there is a real near-real-time requirement and explicit cost approval.

BigQuery is valuable for raw event retention, reproducible SQL, funnel reconstruction, anomaly checks, and reconciling GA4 UI/Windsor differences. It is not enabled by repository code alone; GA4 Editor access plus an authorized Google Cloud project are required.

## Data-quality policy

Daily automation performs non-ingesting checks only:

- public CSP still permits GA4
- Ads hosts are not added
- Google tag endpoint returns HTTP 200
- IDs and event contracts remain consistent
- no Measurement Protocol secret enters the repository

The automation deliberately does **not** generate synthetic GA4 pageviews. A synthetic collection monitor may be enabled only after a GA4 developer-traffic filter is configured so test events cannot contaminate production reporting.

## Expansion order

1. Realtime verification — PASS.
2. DebugView verification — pending.
3. Developer-traffic filter — pending.
4. BigQuery daily export — pending external Google Cloud/GA4 setup.
5. Measurement Protocol server events — pending secret and privacy review.
6. Google Ads/offline conversion optimization — outside this phase and remains disabled.
