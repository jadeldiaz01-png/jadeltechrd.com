import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const pages = [
  "guias.html",
  "guia-automatizacion-leads.html",
  "guia-chatbot-soporte.html",
];
const ga4 = read("ga4-loader.js");
const funnel = read("revenue-funnel.js");

test("educational guides load analytics through the consent UI and a narrow CSP", () => {
  const scripts = [
    "/ga4-config.js",
    "/ga4-loader.js",
    "/analytics-consent.js",
    "/revenue-funnel.js",
  ];

  for (const path of pages) {
    const html = read(path);
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || "";
    assert.match(csp, /script-src 'self' https:\/\/\*\.googletagmanager\.com/);
    assert.match(csp, /connect-src 'self'[^"]*google-analytics\.com/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.match(html, /analytics-consent\.css/);

    let previousIndex = -1;
    for (const src of scripts) {
      const index = html.indexOf(`<script src="${src}" defer></script>`);
      assert.ok(index > previousIndex, `${path} must load ${src} in order`);
      previousIndex = index;
    }
  }
});

test("lead automation guide tracks its Blueprint CTA and preserves offer attribution", () => {
  const html = read("guia-automatizacion-leads.html");
  const link = html.match(/<a(?=[^>]*data-revenue-event="offer_cta_click")(?=[^>]*data-cta-id="guide_lead_blueprint")[^>]*>[\s\S]*?<\/a>/)?.[0];
  assert.ok(link, "guide has a specifically identified Blueprint CTA");

  const href = link.match(/href="([^"]+)"/)?.[1] || "";
  const params = new URLSearchParams(href.split("?")[1]?.replace(/&amp;/g, "&") || "");
  assert.equal(params.get("offer_id"), "automation_blueprint");
  assert.equal(params.get("service_id"), "architecture");
  assert.match(funnel, /guide_(?:index|lead)_blueprint/);
  assert.match(ga4, /guide_(?:index|lead)_blueprint/);
});

test("guide index offers a measured path to the entry Blueprint", () => {
  const html = read("guias.html");
  const link = html.match(/<a(?=[^>]*data-revenue-event="offer_cta_click")(?=[^>]*data-cta-id="guide_index_blueprint")[^>]*>[\s\S]*?<\/a>/)?.[0];
  assert.ok(link, "guide index has a specifically identified Blueprint CTA");

  const href = link.match(/href="([^"]+)"/)?.[1] || "";
  const params = new URLSearchParams(href.split("?")[1]?.replace(/&amp;/g, "&") || "");
  assert.equal(params.get("offer_id"), "automation_blueprint");
  assert.equal(params.get("service_id"), "architecture");
});

test("GA4 does not load or send events before consent and stops after revocation", () => {
  const events = {};
  const dataLayer = [];
  const insertedScripts = [];
  const window = {
    JADEL_GA4_CONFIG: { enabled: true, measurementId: "G-TEST123", consentRequired: true },
    dataLayer,
    addEventListener(name, handler) { events[name] = handler; },
  };
  const document = {
    head: { appendChild(script) { insertedScripts.push(script); } },
    createElement() { return {}; },
  };

  runInNewContext(read("ga4-loader.js"), { window, document, Date, encodeURIComponent });
  const revenueEvent = {
    detail: {
      event: "offer_cta_click",
      params: {
        offer_id: "automation_blueprint",
        service_id: "architecture",
        cta_id: "guide_lead_blueprint",
        utm_content: "guide_lead_blueprint",
      },
    },
  };

  events["jadel:revenue-event"](revenueEvent);
  assert.equal(insertedScripts.length, 0);
  assert.equal(dataLayer.some((entry) => entry[0] === "event"), false);

  assert.equal(window.JadelGA4.grantAnalyticsConsent(), true);
  assert.equal(insertedScripts.length, 1);
  events["jadel:revenue-event"](revenueEvent);
  const click = dataLayer.find((entry) => entry[0] === "event" && entry[1] === "offer_cta_click");
  assert.ok(click);
  assert.equal(click[2].cta_id, "guide_lead_blueprint");
  assert.equal(click[2].utm_content, "guide_lead_blueprint");

  window.JadelGA4.denyAnalyticsConsent();
  events["jadel:revenue-event"](revenueEvent);
  assert.equal(dataLayer.filter((entry) => entry[0] === "event").length, 1);
});
