import fs from "node:fs";

const gate = JSON.parse(fs.readFileSync("config/ga4-activation-gate.json", "utf8"));
const funnel = JSON.parse(fs.readFileSync("config/revenue-funnel-v1.json", "utf8"));
const configJs = fs.readFileSync("ga4-config.js", "utf8");
const loader = fs.readFileSync("ga4-loader.js", "utf8");
const fail = (message) => {
  console.error("GA4_ACTIVATION_GATE=FAIL", message);
  process.exit(1);
};

if (gate.schema_version !== "1.0.0") fail("schema version");
if (gate.ads.max_unapproved_spend_usd !== 0) fail("unapproved spend must remain zero");
if (gate.ads.paid_acquisition_authorized !== false) fail("paid acquisition must remain false");
if (gate.privacy.pii_in_browser_analytics_allowed !== false) fail("PII browser analytics must remain forbidden");
if (gate.privacy.load_google_tag_before_analytics_consent !== false) fail("tag must not load before consent");
if (gate.privacy.default_analytics_storage !== "denied") fail("analytics storage default must be denied");
if (!loader.includes("parameterAllowlist")) fail("parameter allowlist missing");
if (!loader.includes("forbidden")) fail("PII deny guard missing");
if (!loader.includes("grantAnalyticsConsent")) fail("explicit consent grant missing");
if (!loader.includes('ad_storage: "denied"')) fail("ads storage must remain denied");

const measurement = gate.google_analytics.measurement_id;
const activationReady =
  gate.google_analytics.account_confirmed === true &&
  gate.google_analytics.property_confirmed === true &&
  gate.google_analytics.web_stream_confirmed === true &&
  gate.google_analytics.editor_access_confirmed === true &&
  gate.google_analytics.realtime_verified === true &&
  gate.google_analytics.debugview_verified === true &&
  gate.privacy.consent_ui_verified === true;

if (!activationReady) {
  if (measurement !== null) {
    if (!/^G-[A-Z0-9]+$/.test(String(measurement))) fail("recorded Measurement ID must be a valid G- id");
    if (!configJs.includes(`measurementId: "${measurement}"`)) fail("recorded Measurement ID must match ga4-config");
    if (funnel.analytics.measurement_id !== measurement) fail("funnel Measurement ID mismatch");
    if (funnel.analytics.activation_state !== "MEASUREMENT_ID_CONFIRMED_PENDING_VALIDATION") fail("funnel state must reflect pending validation");
  } else {
    if (!configJs.includes('measurementId: ""')) fail("no placeholder Measurement ID allowed");
    if (funnel.analytics.activation_state !== "MEASUREMENT_ID_REQUIRED") fail("missing-id funnel state mismatch");
  }
  if (!configJs.includes('enabled: false')) fail("GA4 config must remain disabled until activation evidence passes");
  console.log("GA4_ACTIVATION_GATE=PASS_BLOCKED");
  process.exit(0);
}

if (!/^G-[A-Z0-9]+$/.test(String(measurement))) fail("real G- Measurement ID required");
if (!configJs.includes(`measurementId: "${measurement}"`)) fail("ga4-config mismatch");
if (!configJs.includes("enabled: true")) fail("GA4 config not enabled");
console.log("GA4_ACTIVATION_GATE=PASS_ACTIVE");
