import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync("config/ga4-bigquery-daily-export-v1.json", "utf8"));
const control = JSON.parse(fs.readFileSync("config/analytics-control-plane-v1.json", "utf8"));
const fail = (m) => { console.error("BIGQUERY_EXPORT_READINESS=FAIL", m); process.exit(1); };

if (cfg.schema_version !== "1.0.0") fail("schema version");
if (cfg.ga4.property_id !== "555066228") fail("property id");
if (cfg.ga4.stream_id !== "15812262707") fail("stream id");
if (cfg.ga4.measurement_id !== "G-K60SQ2ZHL9") fail("measurement id");
if (cfg.ga4.realtime_verified !== true) fail("Realtime evidence required");
if (cfg.ga4.debugview_verified !== true) fail("DebugView evidence required");
if (cfg.bigquery.dataset_expected !== "analytics_555066228") fail("dataset naming");
if (cfg.bigquery.daily_export !== true) fail("daily export must be target");
if (cfg.bigquery.streaming_export !== false) fail("streaming must remain off");
if (cfg.bigquery.dataset_location !== "US") fail("dataset location must match verified link");
if (cfg.bigquery.dataset_location_verified !== true) fail("dataset location evidence required");
if (cfg.bigquery.link_details_completed !== true) fail("completed link details evidence required");
if (cfg.security.static_service_account_json_allowed !== false) fail("static JSON key forbidden");
if (cfg.security.github_oidc_workload_identity_target !== true) fail("OIDC/WIF target required");
if (cfg.security.max_unapproved_ad_spend_usd !== 0) fail("unapproved spend");
if (control.architecture.bigquery_export.enabled !== false) fail("control plane must remain gated until external link exists");

const templates = cfg.post_link_observability.sql_templates;
for (const p of templates) {
  if (!fs.existsSync(p)) fail("missing SQL template " + p);
  const sql = fs.readFileSync(p, "utf8");
  if (!sql.includes("__GCP_PROJECT_ID__")) fail("missing GCP placeholder " + p);
  if (!sql.includes("analytics_555066228")) fail("wrong dataset " + p);
}
console.log("BIGQUERY_EXPORT_READINESS=PASS_READY_FOR_EXTERNAL_LINK");
