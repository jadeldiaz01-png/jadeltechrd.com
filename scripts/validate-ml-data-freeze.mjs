import fs from "node:fs";

const policy = JSON.parse(fs.readFileSync("config/ml-dataset-freeze-policy-2026.json","utf8"));
const evidence = JSON.parse(fs.readFileSync("evidence/analytics/ga4-observed-2026-09-20.json","utf8"));
const analytics = JSON.parse(fs.readFileSync("config/analytics-control-plane-v1.json","utf8"));
const errors = [];

function requireValue(condition, message) {
  if (!condition) errors.push(message);
}

requireValue(policy.schema_version === "2026.1", "unexpected dataset-freeze schema");
requireValue(policy.production_model_authorized === false, "production model authority must remain false");
requireValue(policy.offline_training_authorized === false, "offline training must remain gated until freeze evidence exists");
requireValue(policy.shadow_scoring_authorized === false, "shadow scoring must remain gated until offline evaluation exists");
requireValue(policy.join_contract?.field === "lead_event_id", "lead_event_id join contract missing");
requireValue(policy.join_contract?.format === "UUIDv4", "lead join id must be UUIDv4");
requireValue(policy.join_contract?.persistent_user_identifier === false, "join id must not be a persistent user identifier");
requireValue(policy.join_contract?.persistent_device_identifier === false, "join id must not be a persistent device identifier");
requireValue(policy.join_contract?.pii === false, "join id must not be PII");
requireValue(policy.join_contract?.registered_as_ga4_custom_dimension === false, "high-cardinality join id must not be registered as a GA4 custom dimension");
requireValue(policy.freeze_contract?.stable_ga4_daily_table_lag_days >= 4, "freeze must wait beyond GA4 normal late-arrival window");
requireValue(policy.current_decision?.dataset_freeze === "BLOCKED", "dataset freeze must remain blocked until live gates pass");
requireValue(policy.current_decision?.offline_ml === "BLOCKED", "offline ML must remain blocked");
requireValue(policy.current_decision?.shadow_ml === "BLOCKED", "shadow ML must remain blocked");

const pageView = evidence.observations?.find((x) => x.event_name === "page_view");
requireValue(evidence.interpretation?.ga4_live_data_present === true, "real GA4 observation is required");
requireValue(Number(pageView?.event_count || 0) > 0, "real page_view evidence missing");
requireValue(Number(pageView?.active_users || 0) > 0, "real active-user evidence missing");
requireValue(evidence.interpretation?.bigquery_export_verified === false, "BigQuery must not be claimed verified before live evidence");
requireValue(evidence.interpretation?.training_dataset_ready === false, "training dataset must not be claimed ready");

const requiredAnalyticsIds = ["555066228","15812262707","G-K60SQ2ZHL9"];
const analyticsText = JSON.stringify(analytics);
for (const id of requiredAnalyticsIds) requireValue(analyticsText.includes(id), `analytics identity missing: ${id}`);

const sqlFiles = [
  "analytics/bigquery/20_lead_training_point_in_time.sql.tmpl",
  "analytics/bigquery/21_freeze_training_dataset.sql.tmpl",
  "analytics/bigquery/22_offline_logreg_eval.sql.tmpl",
  "analytics/bigquery/23_shadow_score.sql.tmpl",
];
for (const file of sqlFiles) {
  requireValue(fs.existsSync(file) && fs.statSync(file).size > 0, `missing SQL template: ${file}`);
}
const pointInTime = fs.readFileSync(sqlFiles[0],"utf8");
const freeze = fs.readFileSync(sqlFiles[1],"utf8");
const offline = fs.readFileSync(sqlFiles[2],"utf8");
const shadow = fs.readFileSync(sqlFiles[3],"utf8");

requireValue(pointInTime.includes("lead_event_id"), "point-in-time query must join on lead_event_id");
requireValue(pointInTime.includes("g.lead_event_ts < l.label_ts"), "point-in-time query must prevent post-outcome leakage");
requireValue(pointInTime.includes("INTERVAL 4 DAY"), "point-in-time query must use stable GA4 daily tables");
requireValue(!/key='(?:name|email|phone|company|notes|message|turnstile_token|idempotency_key|api_secret)'/i.test(pointInTime), "point-in-time query reads prohibited GA4 parameter");
requireValue(freeze.includes("__TRAIN_END_DATE__") && freeze.includes("__HOLDOUT_END_DATE__"), "temporal cutoff placeholders missing");
requireValue(!/RAND\s*\(/i.test(freeze + offline), "random splitting is prohibited");
requireValue(offline.includes("MODEL_TYPE='LOGISTIC_REG'"), "logistic baseline missing");
requireValue(offline.includes("MODEL_TYPE='BOOSTED_TREE_CLASSIFIER'"), "boosted-tree challenger missing");
requireValue(offline.includes("ML.EVALUATE"), "offline holdout evaluation missing");
requireValue(shadow.includes("FALSE AS external_side_effects_authorized"), "shadow output must hardcode no external authority");

if (errors.length) {
  console.error("ML dataset freeze validation FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("ML_DATA_FREEZE_CONTRACT=PASS GA4_REAL_DATA=OBSERVED BIGQUERY=GATED LABELS=GATED ML=BLOCKED");
