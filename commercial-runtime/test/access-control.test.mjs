import test from "node:test";
import assert from "node:assert/strict";
import { handleProjectRequest } from "../src/worker.mjs";

test("cross-origin anonymous write is denied before any runtime side effect", async () => {
  let limited = false;
  const env = {
    PUBLIC_ORIGIN: "https://jadeltechrd.com",
    TURNSTILE_SECRET_KEY: "secret",
    PROJECT_REQUEST_RATE_LIMITER: { limit: async () => { limited = true; return { success: true }; } },
    DB: {}
  };
  const request = new Request("https://jadeltechrd.com/api/v1/project-requests", {
    method: "POST",
    headers: { origin: "https://evil.example", "idempotency-key": "1234567890abcdef" },
    body: "{}"
  });
  const response = await handleProjectRequest(request, env);
  assert.equal(response.status, 403);
  assert.equal(limited, false);
});

test("missing server bindings fail closed", async () => {
  const request = new Request("https://jadeltechrd.com/api/v1/project-requests", {
    method: "POST",
    headers: { origin: "https://jadeltechrd.com", "idempotency-key": "1234567890abcdef" },
    body: "{}"
  });
  const response = await handleProjectRequest(request, { PUBLIC_ORIGIN: "https://jadeltechrd.com" });
  assert.equal(response.status, 503);
});
