import fs from "node:fs";

const gate = JSON.parse(fs.readFileSync("config/ga4-activation-gate.json", "utf8"));
const funnel = JSON.parse(fs.readFileSync("config/revenue-funnel-v1.json", "utf8"));
const configJs = fs.readFileSync("ga4-config.js", "utf8");
const loader = fs.readFileSync("ga4-loader.js", "utf8");
const consent = fs.readFileSync("analytics-consent.js", "utf8");
const fail = (message) => {
  console.error("GA4_ACTIVATION_GATE=FAIL", message);
  process.exit(1);
};

const state = gate.state;
const measurement = gate.google_analytics.measurement_id;
const validMeasurement = /^G-[A-Z0-9]+$/.test(String(measurement || ""));
const enabled = configJs.includes("enabled: true");
const disabled = configJs.includes("enabled: false");
const debugOn = configJs.includes("debugMode: true");
const debugOff = configJs.includes("debugMode: false");

if (gate.schema_version !== "1.0.0") fail("schema version");
if (gate.ads.max_unapproved_spend_usd !== 0) fail("unapproved spend must remain zero");
if (gate.ads.paid_acquisition_authorized !== false) fail("paid acquisition must remain false");
if (gate.ads.google_ads_linked !== false) fail("Google Ads must remain unlinked");
if (gate.privacy.pii_in_browser_analytics_allowed !== false) fail("PII browser analytics must remain forbidden");
if (gate.privacy.load_google_tag_before_analytics_consent !== false) fail("basic consent mode requires tag blocked before consent");
if (gate.privacy.default_analytics_storage !== "denied") fail("analytics storage default must be denied");
for (const key of ["default_ad_storage","default_ad_user_data","default_ad_personalization"]) {
  if (gate.privacy[key] !== "denied") fail(key + " must remain denied");
}
if (!loader.includes("parameterAllowlist") || !loader.includes("forbidden")) fail("analytics parameter guard missing");
if (!loader.includes("grantAnalyticsConsent") || !loader.includes("denyAnalyticsConsent")) fail("consent API missing");
if (!consent.includes("Aceptar analítica") || !consent.includes("Solo necesarias")) fail("explicit consent UI missing");
if (!consent.includes("Preferencias de analítica")) fail("consent withdrawal/reopen control missing");

for (const page of ["index.html","whatsapp-ia-empresas-rd.html","automatizacion-procesos-ia-rd.html","agente-ventas-ia-rd.html","solicitar-proyecto.html"]) {
  const html = fs.readFileSync(page, "utf8");
  if (html.includes("\\n  <script")) fail(page + " contains escaped newline markup");
  if (!html.includes("https://www.googletagmanager.com")) fail(page + " CSP missing googletagmanager");
  if (!html.includes("https://*.google-analytics.com")) fail(page + " CSP missing google-analytics endpoints");
  if (html.includes("doubleclick.net") || html.includes("googlesyndication.com")) fail(page + " must not allow Ads endpoints");
  if (!html.includes("/analytics-consent.js") || !html.includes("/analytics-consent.css")) fail(page + " consent assets missing");
}

if (state === "MEASUREMENT_ID_REQUIRED") {
  if (measurement !== null) fail("measurement id must be null");
  if (!disabled) fail("GA4 must be disabled");
  console.log("GA4_ACTIVATION_GATE=PASS_BLOCKED_NO_ID");
  process.exit(0);
}

if (!validMeasurement) fail("real G- Measurement ID required");
if (!configJs.includes(`measurementId: "${measurement}"`)) fail("ga4-config measurement mismatch");
if (funnel.analytics.measurement_id !== measurement) fail("funnel measurement mismatch");

if (state === "MEASUREMENT_ID_CONFIRMED_PENDING_VALIDATION") {
  if (!disabled || !debugOff) fail("pending state must be disabled");
  if (funnel.analytics.activation_state !== state) fail("funnel pending state mismatch");
  console.log("GA4_ACTIVATION_GATE=PASS_PENDING_VALIDATION");
  process.exit(0);
}

if (state === "CONTROLLED_VALIDATION_ACTIVE") {
  if (!enabled || !debugOn) fail("controlled validation requires enabled=true and debugMode=true");
  if (gate.google_analytics.account_confirmed !== true || gate.google_analytics.property_confirmed !== true || gate.google_analytics.web_stream_confirmed !== true) fail("GA4 property/stream not confirmed");
  if (gate.google_analytics.windsor_read_connection_confirmed !== true) fail("Windsor GA4 read connection not confirmed");
  if (gate.privacy.consent_ui_verified !== true || gate.privacy.csp_validated !== true) fail("consent/CSP validation missing");
  if (funnel.analytics.activation_state !== state) fail("funnel controlled state mismatch");
  console.log("GA4_ACTIVATION_GATE=PASS_CONTROLLED_VALIDATION");
  process.exit(0);
}

if (state === "ACTIVE") {
  if (!enabled || !debugOff) fail("ACTIVE requires enabled=true and debugMode=false");
  if (gate.google_analytics.realtime_verified !== true || gate.google_analytics.debugview_verified !== true) fail("Realtime/DebugView evidence required");
  if (gate.privacy.consent_ui_verified !== true || gate.privacy.csp_validated !== true) fail("consent/CSP evidence required");
  if (funnel.analytics.activation_state !== "ACTIVE") fail("funnel active state mismatch");
  console.log("GA4_ACTIVATION_GATE=PASS_ACTIVE");
  process.exit(0);
}

fail("unsupported gate state " + state);
