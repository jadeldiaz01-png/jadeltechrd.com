import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const maybeRead = (path) => existsSync(new URL(path, root)) ? read(path) : "";

function element({ hidden = false, disabled = false } = {}) {
  return {
    hidden,
    disabled,
    textContent: "",
    listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; },
    click() { if (!this.disabled) this.listeners.click?.(); },
  };
}

test("demo advances through classification, draft, and local approval without sending anything", () => {
  const ids = ["classify-demo", "draft-demo", "approve-demo", "reset-demo", "classification-result", "draft-result", "approval-result", "demo-status"];
  const elements = new Map(ids.map((id) => [id, element({
    hidden: ["classification-result", "draft-result", "approval-result"].includes(id),
    disabled: ["draft-demo", "approve-demo"].includes(id),
  })]));
  let networkCalls = 0;
  const spy = () => { networkCalls += 1; };
  runInNewContext(maybeRead("lead-follow-up-demo.js"), {
    document: { documentElement: { lang: "es" }, getElementById: (id) => elements.get(id) || null },
    fetch: spy,
    XMLHttpRequest: class { open() { spy(); } send() { spy(); } },
    navigator: { sendBeacon: spy },
    window: { fetch: spy, XMLHttpRequest: class { open() { spy(); } send() { spy(); } } },
  });

  elements.get("classify-demo").click();
  assert.equal(elements.get("classification-result").hidden, false);
  assert.equal(elements.get("draft-demo").disabled, false);
  elements.get("draft-demo").click();
  assert.equal(elements.get("draft-result").hidden, false);
  assert.equal(elements.get("approve-demo").disabled, false);
  elements.get("approve-demo").click();
  assert.equal(elements.get("approval-result").hidden, false);
  assert.equal(elements.get("demo-status").textContent, "Aprobado en esta simulación; no se envió ningún mensaje.");
  assert.equal(networkCalls, 0);

  elements.get("reset-demo").click();
  assert.equal(elements.get("classification-result").hidden, true);
  assert.equal(elements.get("draft-demo").disabled, true);
  assert.equal(elements.get("approve-demo").disabled, true);
});

test("the demo quote CTA emits a scoped Blueprint click with the demo landing path", () => {
  const listeners = {};
  const dataLayer = [];
  const target = {
    href: "/solicitar-proyecto.html?services=architecture&offer_id=automation_blueprint&service_id=architecture",
    dataset: { revenueEvent: "offer_cta_click", ctaId: "lead_demo_es" },
    closest(selector) { return selector === "[data-revenue-event]" ? this : null; },
  };
  const window = {
    dataLayer,
    location: { pathname: "/demo-seguimiento-leads.html", search: "", href: "https://jadeltechrd.com/demo-seguimiento-leads.html", origin: "https://jadeltechrd.com" },
    dispatchEvent() {},
  };
  runInNewContext(read("revenue-funnel.js"), {
    URL,
    URLSearchParams,
    CustomEvent: class {},
    document: { body: { dataset: { offerId: "automation_blueprint", serviceId: "architecture" } }, addEventListener(type, handler) { listeners[type] = handler; }, getElementById() { return null; } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    window,
  });

  listeners.click({ target });
  const click = dataLayer.find((event) => event.event === "offer_cta_click");
  assert.deepEqual(JSON.parse(JSON.stringify(click)), {
    event: "offer_cta_click",
    offer_id: "automation_blueprint",
    service_id: "architecture",
    landing_path: "/demo-seguimiento-leads.html",
    utm_content: "lead_demo_es",
    cta_id: "lead_demo_es",
    analytics_activation: "MEASUREMENT_ID_REQUIRED",
  });
});

test("Spanish and English demo pages are discoverable and clearly disclose synthetic behavior", () => {
  const pages = [
    ["demo-seguimiento-leads.html", "es", "https://jadeltechrd.com/demo-seguimiento-leads.html"],
    ["en/lead-follow-up-demo.html", "en", "https://jadeltechrd.com/en/lead-follow-up-demo.html"],
  ];
  for (const [path, locale, canonical] of pages) {
    const page = maybeRead(path);
    assert.ok(page, `${path} must be published`);
    assert.match(page, new RegExp(`<html lang="${locale}">`));
    assert.ok(page.includes(`<link rel="canonical" href="${canonical}">`));
    assert.match(page, /lead-follow-up-demo\.js/);
    assert.match(page, /lead-follow-up-demo\.css/);
    assert.match(page, /datos son sintéticos|synthetic data/i);
    assert.match(page, /no conecta|does not connect/i);
    assert.match(page, /solicitar-proyecto\.html|request-project\.html/);
    assert.doesNotMatch(page, /<form\b/i);
    assert.doesNotMatch(page, /<script\b[^>]*>\s*[^<]/i);
  }
});

test("both Spanish home renderings and the English home link to the matching demo", () => {
  for (const path of ["index.html", "app.js"]) assert.match(read(path), /demo-seguimiento-leads\.html/);
  assert.match(read("en/index.html"), /lead-follow-up-demo\.html/);
});

test("Blueprint detail exposes the matching demo from both language sections", () => {
  const page = read("ai-automation-blueprint.html");
  assert.match(page, /href="\/demo-seguimiento-leads\.html"/);
  assert.match(page, /href="\/en\/lead-follow-up-demo\.html"/);
});

test("Pages allowlist and sitemap include the bilingual demo and its local assets", () => {
  const staging = read(".github/workflows/pages.yml").split("public_assets=(")[1]?.split(")")[0] ?? "";
  for (const asset of ["demo-seguimiento-leads.html", "en/lead-follow-up-demo.html", "lead-follow-up-demo.css", "lead-follow-up-demo.js"]) {
    assert.ok(staging.includes(asset), `${asset} must be staged`);
  }
  const sitemap = read("sitemap.xml");
  assert.ok(sitemap.includes("https://jadeltechrd.com/demo-seguimiento-leads.html"));
  assert.ok(sitemap.includes("https://jadeltechrd.com/en/lead-follow-up-demo.html"));
});
