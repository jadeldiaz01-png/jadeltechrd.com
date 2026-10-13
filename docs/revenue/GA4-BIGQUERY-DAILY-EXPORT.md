# GA4 -> BigQuery Daily Export

Status: **LINK_CREATED_PENDING_FIRST_EXPORT**

## Verified source

- GA4 Property ID: `555066228`
- Web Stream ID: `15812262707`
- Measurement ID: `G-K60SQ2ZHL9`
- Realtime: verified
- DebugView: verified (`page_view`, `session_start`, `user_engagement`)

## Target

Use **Daily Export only** for the first production link.

Expected dataset after Google creates the link:

`analytics_555066228`

Expected daily tables:

`events_YYYYMMDD`

Streaming export stays disabled until a real near-real-time requirement and cost approval exist.

## External linking procedure

The repository cannot create the GA4 product link without an authorized Google Cloud project and GA4 administrative access.

In Google Cloud:
1. Create or select one GCP project dedicated to analytics.
2. Enable the BigQuery API.
3. Do not create or download a long-lived service-account JSON key for GitHub.
4. Record the real project ID and the chosen dataset location.

In GA4 Property **555066228**:
1. Admin -> Product links -> BigQuery links -> Link.
2. Select that GCP project.
3. Choose the dataset location deliberately. For this deployment, use **US** unless you have a specific residency or organization-policy requirement for another location.
4. Include Web Stream **15812262707**.
5. Enable **Daily** export.
6. Leave **Streaming** off.
7. Submit.

After Google creates the link, verify:
- the BigQuery link details show the **built-in resource identity** created for the link;
- that identity has `roles/bigquery.user` at project level;
- the export dataset grants `bigquery.dataOwner` to that identity;
- if Google shows `firebase-measurement@system.gserviceaccount.com`, treat it as a legacy-link identity rather than the expected identity for a new link;
- dataset `analytics_555066228` exists;
- the first `events_YYYYMMDD` table appears.

## DebugView one-time verification — COMPLETE

Evidence captured on 2026-09-20 shows `page_view`, `session_start`, and `user_engagement` in DebugView. Production remains outside debug mode and omits the `debug_mode` parameter when disabled.

## Post-link queries

Templates under `analytics/bigquery/` cover:
- raw daily volume;
- Revenue Funnel stages;
- unexpected event-name drift;
- source/medium quality.

Render them only after the real GCP project ID exists:

`GCP_PROJECT_ID=<real-project-id> node scripts/render-bigquery-sql.mjs`

## CI / GitHub authentication target

For later automated BigQuery checks, use GitHub OIDC -> Google Cloud Workload Identity Federation. Do **not** store a Google service-account JSON private key in GitHub or the repository.

The post-link observer should be enabled only after the GCP project, GA4 link and dataset are verified.


## Post-link verification

The GA4 BigQuery Links page now shows the project `jadeltechrd-analytics-prod` with project number `527094364974`. This proves the product link exists.

Do not mark the export fully active until all of the following are observed:

1. Dataset `analytics_555066228` exists in BigQuery.
2. Daily export is enabled in the link details.
3. Streaming remains disabled.
4. Web Stream `15812262707` is included.
5. The first `events_YYYYMMDD` table appears.

The right-arrow on the GA4 BigQuery Links row should be used to inspect link details before declaring the export complete.
