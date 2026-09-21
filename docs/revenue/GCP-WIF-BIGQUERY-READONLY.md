# Google Cloud WIF — read-only BigQuery evidence

Target project: `jadeltechrd-analytics-prod`.

This repository does not accept long-lived Google service-account JSON keys. Configure GitHub OIDC -> Google Workload Identity Federation instead.

Recommended Google-side identity:

- service account: `github-bigquery-reader@jadeltechrd-analytics-prod.iam.gserviceaccount.com`
- project role: `roles/bigquery.jobUser`
- dataset `analytics_555066228`: `roles/bigquery.dataViewer` plus metadata access as required
- GitHub principal condition: repository must equal `jadeldiaz01-png/jadeltechrd.com`; production BigQuery evidence should be restricted to `refs/heads/main`.

After creating the pool/provider and service account, add these **repository variables** (not secrets):

```
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>
GCP_BIGQUERY_READ_SERVICE_ACCOUNT=github-bigquery-reader@jadeltechrd-analytics-prod.iam.gserviceaccount.com
```

The workflow uses `google-github-actions/auth` pinned to immutable commit `7c6bc770dae815cd3e89ee6cdf493a5fab2cc093` and requests a short-lived access token. No Google credential is committed to the repository.

Do not grant BigQuery Admin, Owner, service-account key creation, dataset delete, billing mutation or unrelated Google Cloud permissions to this identity.
