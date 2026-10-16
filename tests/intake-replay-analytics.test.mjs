import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../project-request.js", import.meta.url), "utf8");

async function submitSuccessfulResponse(body) {
  const listeners = new Map();
  const events = [];
  const selectedService = { value: "architecture", checked: true };
  const fields = [selectedService, { disabled: false }];
  const form = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    querySelectorAll(selector) {
      return selector === 'input[name="service_ids"]:checked' ? [selectedService] : fields;
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
    FormData: class {
      get() { return "test value"; }
    },
    CSS: { escape: (value) => value },
    crypto: { randomUUID: () => "test-idempotency-key-123456" },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      documentElement: { lang: "es-DO" },
      getElementById: (id) => elements.get(id) || null,
    },
    window: {
      location: { search: "" },
      RevenueAnalytics: { track: (...event) => events.push(event) },
      turnstile: {
        render(_selector, options) {
          options.callback("test-turnstile-token");
          return 1;
        },
        reset() {},
      },
    },
    fetch: async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return { ok: true, json: async () => ({ turnstile_sitekey: "test-site-key", turnstile_action: "project_request" }) };
      }
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

test("new accepted intake emits one lead event", async () => {
  const events = await submitSuccessfulResponse({ project_id: "p1", state: "VALIDATED", replayed: false });
  assert.deepEqual(events, [["generate_lead", { lead_source: "project_request" }]]);
});

test("idempotent replay does not emit another lead event", async () => {
  const events = await submitSuccessfulResponse({ project_id: "p1", state: "VALIDATED", replayed: true });
  assert.deepEqual(events, []);
});
