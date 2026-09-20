import fs from "node:fs";

const cp = JSON.parse(fs.readFileSync("config/analytics-control-plane-v1.json", "utf8"));
const ga = JSON.parse(fs.readFileSync("config/ga4-activation-gate.json", "utf8"));
const loader = fs.readFileSync("ga4-loader.js", "utf8");
const revenue = fs.readFileSync("revenue-funnel.js", "utf8");

const fail = (m) => {
  console.error("ANALYTICS_CONTROL_PLANE=FAIL", m);
  process.exit(1);
};

if (cp.schema_version !== "1.0.0") fail("schema version");
if (cp.property.property_id !== ga.google_analytics.property_id) fail("property mismatch");
if (cp.property.stream_id !== ga.google_analytics.stream_id) fail("stream mismatch");
if (cp.property.measurement_id !== ga.google_analytics.measurement_id) fail("measurement mismatch");
if (cp.property.property_id === cp.property.stream_id) fail("property and stream must differ");

if (cp.evidence.browser_transport_verified !== true) fail("transport evidence");
if (cp.evidence.realtime_verified !== true) fail("Realtime evidence");
if (ga.google_analytics.realtime_verified !== true) fail("GA4 gate must record Realtime evidence");

if (cp.architecture.browser_layer.pii_allowed !== false) fail("browser PII forbidden");
if (cp.architecture.browser_layer.ads_storage !== "denied") fail("ad storage");
if (cp.architecture.measurement_protocol.enabled !== false) fail("Measurement Protocol must remain gated");
if (cp.architecture.measurement_protocol.secret_must_never_be_exposed_to_browser !== true) fail("MP secret policy");
if (cp.architecture.bigquery_export.enabled !== false) fail("BigQuery must remain gated until linked");
if (cp.architecture.bigquery_export.streaming_export_target !== false) fail("streaming must remain off");
if (cp.data_quality.synthetic_collection.enabled !== false) fail("synthetic collection must remain off");
if (cp.governance.max_unapproved_ad_spend_usd !== 0) fail("unapproved spend");
if (cp.governance.google_ads_linked !== false) fail("Ads link");
if (cp.governance.measurement_protocol_secret_present_in_repo !== false) fail("secret in repo");

for (const token of ["email","phone","notes","payment","token","secret"]) {
  if (!revenue.includes("prohibitedKeyPattern")) fail("browser PII guard missing");
}
if (!loader.includes("consent")) fail("consent integration missing");

const forbiddenRepoSecretPatterns = [
  /api_secret\s*[:=]\s*[A-Za-z0-9_-]{16,}/i,
  /GA4_MEASUREMENT_PROTOCOL_API_SECRET\s*=\s*[^$\s]/i
];
for (const path of ["ga4-config.js","ga4-loader.js","revenue-funnel.js","config/analytics-control-plane-v1.json"]) {
  const text = fs.readFileSync(path, "utf8");
  for (const pattern of forbiddenRepoSecretPatterns) {
    if (pattern.test(text)) fail("possible Measurement Protocol secret in " + path);
  }
}

console.log("ANALYTICS_CONTROL_PLANE=PASS");
