import test from "node:test";
import assert from "node:assert/strict";
import worker, { verifyTurnstile } from "../src/worker.mjs";

const env = {
  PUBLIC_ORIGIN: "https://jadeltechrd.com",
  PUBLIC_TURNSTILE_SITEKEY: "sitekey",
  TURNSTILE_SECRET_KEY: "secret",
  TURNSTILE_EXPECTED_HOSTNAME: "jadeltechrd.com",
  PROJECT_REQUEST_RATE_LIMITER: { limit: async () => ({ success: true }) },
  DB: {},
};

test("Siteverify requires success, exact hostname, and exact action", async () => {
  const ok = await verifyTurnstile("token", env, "203.0.113.1", async () => new Response(JSON.stringify({
    success: true,
    hostname: "jadeltechrd.com",
    action: "project_request",
  }), { status: 200 }));
  assert.equal(ok.ok, true);

  const wrongHost = await verifyTurnstile("token", env, null, async () => new Response(JSON.stringify({
    success: true,
    hostname: "evil.example",
    action: "project_request",
  }), { status: 200 }));
  assert.equal(wrongHost.ok, false);
  assert.equal(wrongHost.reason, "TURNSTILE_HOSTNAME_MISMATCH");

  const wrongAction = await verifyTurnstile("token", env, null, async () => new Response(JSON.stringify({
    success: true,
    hostname: "jadeltechrd.com",
    action: "login",
  }), { status: 200 }));
  assert.equal(wrongAction.ok, false);
  assert.equal(wrongAction.reason, "TURNSTILE_ACTION_MISMATCH");
});

test("CORS preflight allows only the production site origin", async () => {
  const allowed = await worker.fetch(new Request("https://api.jadeltechrd.com/api/v1/project-requests", {
    method: "OPTIONS",
    headers: { origin: "https://jadeltechrd.com" },
  }), env);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://jadeltechrd.com");

  const denied = await worker.fetch(new Request("https://api.jadeltechrd.com/api/v1/project-requests", {
    method: "OPTIONS",
    headers: { origin: "https://evil.example" },
  }), env);
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});

test("public config is origin-bound and exposes no Turnstile secret", async () => {
  const response = await worker.fetch(new Request("https://api.jadeltechrd.com/api/v1/public-config", {
    headers: { origin: "https://jadeltechrd.com" },
  }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.turnstile_sitekey, "sitekey");
  assert.equal(body.turnstile_action, "project_request");
  assert.equal("TURNSTILE_SECRET_KEY" in body, false);
  assert.equal(JSON.stringify(body).includes("secret"), false);
});
