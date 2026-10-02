import test from "node:test";
import assert from "node:assert/strict";
import { handleProjectRequest } from "../src/worker.mjs";

async function digestObject(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fingerprint(input) {
  return digestObject({
    name: input.name,
    email: input.email,
    company: input.company || "",
    service_ids: input.service_ids,
    offer_id: input.offer_id || "",
    offer_landing_path: input.offer_landing_path || "",
    utm_source: input.utm_source || "",
    utm_medium: input.utm_medium || "",
    utm_campaign: input.utm_campaign || "",
    utm_content: input.utm_content || "",
    notes: input.notes || "",
    locale: input.locale || "es-DO",
  });
}

async function legacyFingerprint(input) {
  return digestObject({
    name: input.name,
    email: input.email,
    company: input.company || "",
    service_ids: input.service_ids,
    notes: input.notes || "",
    locale: input.locale || "es-DO",
  });
}

function runtimeEnv(existing) {
  return {
    PUBLIC_ORIGIN: "https://jadeltechrd.com",
    PUBLIC_TURNSTILE_SITEKEY: "sitekey",
    TURNSTILE_SECRET_KEY: "secret",
    TURNSTILE_EXPECTED_HOSTNAME: "jadeltechrd.com",
    PROJECT_REQUEST_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: {
      prepare() {
        return {
          bind() {
            return { first: async () => existing };
          }
        };
      },
      batch: async () => { throw new Error("batch must not run during replay"); }
    }
  };
}

function requestFor(input, key = "1234567890abcdef") {
  return new Request("https://api.jadeltechrd.com/api/v1/project-requests", {
    method: "POST",
    headers: {
      origin: "https://jadeltechrd.com",
      "content-type": "application/json",
      "idempotency-key": key,
    },
    body: JSON.stringify({ ...input, turnstile_token: "token" }),
  });
}

test("same idempotency key and same normalized payload replay without Siteverify or write", async () => {
  const input = { name: "Cliente prueba", email: "client@example.com", service_ids: ["support"] };
  const requestFingerprint = await fingerprint(input);
  let siteverifyCalls = 0;
  const response = await handleProjectRequest(
    requestFor(input),
    runtimeEnv({ project_id: "p-existing", state: "VALIDATED", policy_status: "PENDING", request_fingerprint: requestFingerprint }),
    { fetchImpl: async () => { siteverifyCalls += 1; throw new Error("must not call Siteverify"); } },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.project_id, "p-existing");
  assert.equal(body.replayed, true);
  assert.equal(siteverifyCalls, 0);
});

test("same idempotency key with different payload fails closed", async () => {
  const original = { name: "Cliente prueba", email: "client@example.com", service_ids: ["support"] };
  const requestFingerprint = await fingerprint(original);
  const changed = { ...original, service_ids: ["meta"] };
  const response = await handleProjectRequest(
    requestFor(changed),
    runtimeEnv({ project_id: "p-existing", state: "VALIDATED", policy_status: "PENDING", request_fingerprint: requestFingerprint }),
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "IDEMPOTENCY_CONFLICT");
});


test("pre-M3 unattributed fingerprint remains replayable without Siteverify", async () => {
  const input = { name:"Cliente legado", email:"legacy@example.com", service_ids:["support"] };
  const requestFingerprint = await legacyFingerprint(input);
  let siteverifyCalls = 0;
  const response = await handleProjectRequest(
    requestFor(input, "legacyretrykey1234"),
    runtimeEnv({
      project_id:"p-legacy",
      state:"VALIDATED",
      policy_status:"PENDING",
      request_fingerprint:requestFingerprint,
    }),
    { fetchImpl:async () => { siteverifyCalls += 1; throw new Error("must not call Siteverify"); } },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.project_id, "p-legacy");
  assert.equal(body.replayed, true);
  assert.equal(siteverifyCalls, 0);
});

test("legacy fingerprint cannot be reused to add offer attribution", async () => {
  const original = { name:"Cliente legado", email:"legacy@example.com", service_ids:["support"] };
  const requestFingerprint = await legacyFingerprint(original);
  const attributed = {
    ...original,
    offer_id:"whatsapp_support",
    utm_source:"website",
  };
  const response = await handleProjectRequest(
    requestFor(attributed, "legacyretrykey5678"),
    runtimeEnv({
      project_id:"p-legacy",
      state:"VALIDATED",
      policy_status:"PENDING",
      request_fingerprint:requestFingerprint,
    }),
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "IDEMPOTENCY_CONFLICT");
});
