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
const allowedAnalyticsStates = new Set(["MEASUREMENT_ID_REQUIRED","MEASUREMENT_ID_CONFIRMED_PENDING_VALIDATION","CONTROLLED_VALIDATION_ACTIVE","TRANSPORT_VERIFIED_PENDING_GA_UI","ACTIVE"]);
if (!allowedAnalyticsStates.has(cfg.analytics.activation_state)) fail("invalid analytics activation state");
if (cfg.analytics.activation_state === "MEASUREMENT_ID_REQUIRED" && cfg.analytics.measurement_id !== null) fail("measurement id must be null when required");
if (cfg.analytics.activation_state !== "MEASUREMENT_ID_REQUIRED" && !/^G-[A-Z0-9]+$/.test(String(cfg.analytics.measurement_id || ""))) fail("verified GA4 measurement id required");
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

const homepage = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const quoteCtas = [...homepage.matchAll(/<a\b(?=[^>]*\bclass="[^"]*\bservice-quote\b)[^>]*>/g)].map((match) => match[0]);
if (quoteCtas.length !== 11) fail("homepage static quote CTA count");
const ctaIds = quoteCtas.map((anchor) => {
  if (!anchor.includes('data-revenue-event="offer_cta_click"')) fail("static quote CTA event");
  const match = anchor.match(/\bdata-cta-id="(service_quote_[a-z0-9]+)"/);
  if (!match) fail("static quote CTA id");
  return match[1];
});
if (new Set(ctaIds).size !== ctaIds.length) fail("static quote CTA ids must be unique");
if (!homepage.includes('src="/revenue-funnel.js"')) fail("homepage revenue funnel script missing");
if (homepage.indexOf('src="/revenue-funnel.js"') > homepage.indexOf('src="/app.js"')) fail("revenue funnel must load before app");
if (!app.includes('data-revenue-event="offer_cta_click"') || !app.includes('data-cta-id="service_quote_${service.id}"')) fail("dynamic quote CTA instrumentation");

console.log("REVENUE_FUNNEL_V1=PASS");
