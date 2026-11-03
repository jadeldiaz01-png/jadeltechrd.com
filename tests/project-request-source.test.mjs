import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const script = readFileSync(new URL("project-request.js", root), "utf8");
const funnel = readFileSync(new URL("revenue-funnel.js", root), "utf8");
const ga4 = readFileSync(new URL("ga4-loader.js", root), "utf8");

async function submitSuccessfulResponse(body) {
  const listeners = new Map();
  const events = [];
  const service = { value: "architecture", checked: true, disabled: false };
  const formFields = [service, { disabled: false }];
  const form = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    querySelectorAll(selector) {
      return selector === 'input[name="service_ids"]:checked' ? [service] : formFields;
    },
    reportValidity: () => true,
  };
  const elements = new Map([
    ["project-request-form", form],
    ["submit-project", { disabled: true }],
    ["request-status", { dataset: {} }],
    ["turnstile-status", {}],
    ["retry-runtime", { hidden: true, addEventListener() {} }],
    ["privacy-consent", { checked: true }],
    ["year", {}],
  ]);
  let fetchCount = 0;
  const sandbox = {
    URLSearchParams,
    FormData: class { get() { return "test value"; } },
    CSS: { escape: (value) => value },
    crypto: { randomUUID: () => "test-idempotency-key-123456" },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      documentElement: { lang: "es-DO" },
      getElementById: (id) => elements.get(id) || null,
    },
    window: {
      location: { pathname: "/solicitar-proyecto.html", search: "" },
      RevenueAnalytics: { track: (...event) => events.push(event) },
      turnstile: {
        render(_selector, options) { options.callback("test-turnstile-token"); return 1; },
        reset() {},
      },
    },
    fetch: async () => {
      fetchCount += 1;
      if (fetchCount === 1) return { ok: true, json: async () => ({ turnstile_sitekey: "test-site-key", turnstile_action: "project_request" }) };
      return { ok: true, json: async () => body };
    },
    setTimeout,
    Date,
  };
  runInNewContext(script, sandbox);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await listeners.get("submit")({ preventDefault() {} });
  return JSON.parse(JSON.stringify(events));
}

test("a newly accepted project request emits one specifically labeled lead", async () => {
  const events = await submitSuccessfulResponse({ project_id: "req-1", replayed: false });
  assert.deepEqual(events, [["generate_lead", { lead_source: "project_request" }]]);
});

test("an idempotent replay does not count as a new lead", async () => {
  const events = await submitSuccessfulResponse({ project_id: "req-1", replayed: true });
  assert.deepEqual(events, []);
});

test("both analytics allowlists accept the specific project request source", () => {
  assert.match(funnel, /lead_source: new Set\(\["website", "project_request"\]\)/);
  assert.match(ga4, /lead_source: new Set\(\["website", "project_request"\]\)/);
});
