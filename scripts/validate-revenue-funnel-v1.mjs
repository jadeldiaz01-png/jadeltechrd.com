import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync("config/revenue-funnel-v1.json", "utf8"));
const fail = (m) => { console.error("REVENUE_FUNNEL_V1=FAIL", m); process.exit(1); };

if (cfg.schema_version !== "1.0.0") fail("schema_version");
if (!Array.isArray(cfg.offers) || cfg.offers.length !== 3) fail("exactly three offers required");
const ids = new Set(cfg.offers.map((x) => x.id));
if (ids.size !== 3) fail("offer ids must be unique");
for (const offer of cfg.offers) {
  if (!offer.landing_path?.startsWith("/")) fail("landing path");
  if (!fs.existsSync(offer.landing_path.slice(1))) fail("missing landing " + offer.landing_path);
  if (!(offer.setup_price_usd > 0)) fail("setup price");
}
if (cfg.analytics.activation_state !== "MEASUREMENT_ID_REQUIRED") fail("analytics must remain gated");
if (cfg.analytics.measurement_id !== null) fail("do not invent GA4 measurement id");
const requiredGa = ["generate_lead","qualify_lead","disqualify_lead","working_lead","close_convert_lead","close_unconvert_lead"];
const declared = new Set([...cfg.analytics.browser_events, ...cfg.analytics.server_or_crm_events]);
for (const event of requiredGa) if (!declared.has(event)) fail("missing GA4 lead event " + event);
if (cfg.principles.max_unapproved_ad_spend_usd !== 0) fail("unapproved spend must remain zero");
if (cfg.principles.no_pii_in_browser_analytics !== true) fail("PII browser policy");
if (cfg.principles.financial_and_trading_domains_independent !== true) fail("domain separation");
const sitemap = fs.readFileSync("sitemap.xml", "utf8");
for (const offer of cfg.offers) {
  const url = "https://jadeltechrd.com" + offer.landing_path;
  if (!sitemap.includes(url)) fail("sitemap missing " + url);
}
const analytics = fs.readFileSync("revenue-funnel.js", "utf8");
for (const token of ["email","phone","notes","payment"]) {
  if (!analytics.includes("prohibitedKeyPattern")) fail("analytics PII guard missing");
}
console.log("REVENUE_FUNNEL_V1=PASS");
