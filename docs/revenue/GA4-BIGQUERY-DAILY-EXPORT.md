# GA4 -> BigQuery Daily Export

Status: **READY_FOR_EXTERNAL_LINK**

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
3. Choose the dataset location deliberately; do not guess it in repository code.
4. Include Web Stream **15812262707**.
5. Enable **Daily** export.
6. Leave **Streaming** off.
7. Submit.

After Google creates the link, verify:
- service account `firebase-measurement@system.gserviceaccount.com` exists in the project;
- project role is `roles/bigquery.user`;
- the export dataset grants `bigquery.dataOwner` to that service account;
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
