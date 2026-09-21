# ML Dataset Freeze + Offline/Shadow v1

Status: **GA4 real data observed; BigQuery daily export and terminal commercial labels remain gated.**

## Real evidence already observed

The authorized read-only GA4 connector returned real production activity for `jadeltechrd.com` on 2026-09-20: 6 active users, 9 `session_start` events, 9 `page_view` events/views, 6 `first_visit`, 3 `user_engagement` and 1 `scroll`. No key events or custom funnel events were returned in that observation. The aggregate evidence is stored in `evidence/analytics/ga4-observed-2026-09-20.json`.

This proves GA4 collection exists. It does **not** prove that the GA4 -> BigQuery daily export exists.

## Privacy-safe lead-to-outcome join

A successful project request now carries a one-time UUIDv4 `lead_event_id`. The same value is:

1. sent with the governed intake payload;
2. stored in D1 as `project_requests.analytics_join_id`;
3. emitted only on the successful `generate_lead` GA4 event.

It is not a name, email, phone number, account ID, user ID or persistent device/session identifier. It is scoped to one project-request submission. It is intentionally **not registered as a GA4 custom dimension**; the raw BigQuery export is the only analytical use, avoiding high-cardinality report configuration.

## Commercial outcome labels

The authenticated operator console now supports the append-only lifecycle:

```
working_lead
  -> qualify_lead
       -> close_convert_lead
       -> close_unconvert_lead
  -> disqualify_lead
```

Terminal positives are `close_convert_lead`. Terminal negatives are `close_unconvert_lead` and `disqualify_lead`. Intermediate/unresolved projects are excluded from supervised training.

The production-label readiness job reads only aggregate counts from D1 and exports no customer PII.

## Freeze rules

The first training dataset may be frozen only after:

- a real `analytics_555066228.events_YYYYMMDD` daily table is observed;
- GA4 event dates used for training are at least four calendar days old;
- at least one positive and one negative terminal label exist;
- every row joins by `lead_event_id`;
- the GA4 event occurs strictly before the commercial label timestamp;
- duplicate join IDs are zero;
- no direct identifiers, free text, auth material or payment identifiers are features;
- train/holdout dates are preregistered;
- source SHA, query hash, feature-schema hash and content hash are recorded.

Four days is deliberately conservative because GA4 daily export tables can be updated for late-arriving events during the normal post-event processing window.

## Offline evaluation

The initial comparison order is deterministic base-rate -> logistic regression -> boosted tree. DNN remains research-only until data volume, stability and incremental-value gates justify it.

No random train/test split is permitted. The holdout is later in time than training. `ML.EVALUATE` is run only against the frozen holdout. Point estimates are not sufficient for promotion; class counts, uncertainty, segment/regime stability and reproducibility remain required evidence.

## Shadow mode

After offline evidence is acceptable, the logistic model may score new leads into a dedicated shadow table. Every score is tagged with its model revision and `external_side_effects_authorized=false`. Scores cannot change ads, publish content, contact customers, execute payments or allocate capital.

## BigQuery access from GitHub

The live BigQuery job uses keyless Google Cloud Workload Identity Federation. Static service-account JSON keys remain prohibited.

Required GitHub repository variables:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_BIGQUERY_READ_SERVICE_ACCOUNT`

The Google service account should have only the permissions required to create query jobs and read metadata/data for the GA4 dataset. The production trust condition should restrict GitHub identity to this repository and the protected `main` branch.

Until those variables and the Google-side WIF trust exist, the live BigQuery job is skipped rather than fabricating evidence.
