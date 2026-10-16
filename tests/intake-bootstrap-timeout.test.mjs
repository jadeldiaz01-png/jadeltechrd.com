import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../project-request.js", import.meta.url), "utf8");

function startBootstrap(fetchImpl) {
  let timerId = 0;
  const activeTimers = new Map();
  let requestedSignal;
  const form = {
    addEventListener() {},
    querySelectorAll() { return []; },
  };
  const elements = {
    "project-request-form": form,
    "submit-project": { disabled: false },
    "request-status": { textContent: "", dataset: {} },
    "turnstile-status": { textContent: "" },
    "retry-runtime": { hidden: false, addEventListener() {} },
    "privacy-consent": { checked: false },
    year: { textContent: "" },
  };
  const context = {
    AbortController,
    CSS: { escape: (value) => value },
    URLSearchParams,
    crypto: { randomUUID: () => "test-idempotency-key" },
    document: {
      documentElement: { lang: "es-DO" },
      getElementById: (id) => elements[id] || null,
    },
    fetch(url, options = {}) {
      requestedSignal = options.signal;
      return fetchImpl(url, options);
    },
    formData: class {},
    sessionStorage: { getItem() {}, setItem() {}, removeItem() {} },
    setTimeout(callback, delay) {
      const id = ++timerId;
      activeTimers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { activeTimers.delete(id); },
    window: { location: { search: "" } },
  };

  vm.runInNewContext(source, context, { filename: "project-request.js" });
  return {
    elements,
    requestedSignal: () => requestedSignal,
    expireConfigTimeout() {
      const [id, timeout] = [...activeTimers].find(([, timer]) => timer.delay === 8000) || [];
      assert.ok(timeout, "public-config fetch and body parsing have a bounded timeout");
      activeTimers.delete(id);
      timeout.callback();
    },
  };
}

test("a stalled public-config request fails closed and exposes retry", async () => {
  const app = startBootstrap((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
  }));
  assert.ok(app.requestedSignal(), "fetch can be aborted when the timeout expires");
  app.expireConfigTimeout();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(app.requestedSignal().aborted, true);
  assert.equal(app.elements["retry-runtime"].hidden, false);
  assert.match(app.elements["turnstile-status"].textContent, /no respondió a tiempo/i);
  assert.match(app.elements["request-status"].textContent, /No se enviaron datos/);
  assert.equal(app.elements["submit-project"].disabled, true);
});

test("a stalled public-config body keeps the same timeout active", async () => {
  const app = startBootstrap((_url, options) => Promise.resolve({
    ok: true,
    json() {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
      });
    },
  }));
  await new Promise((resolve) => setImmediate(resolve));

  app.expireConfigTimeout();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(app.requestedSignal().aborted, true);
  assert.equal(app.elements["retry-runtime"].hidden, false);
  assert.match(app.elements["request-status"].textContent, /No se enviaron datos/);
});
