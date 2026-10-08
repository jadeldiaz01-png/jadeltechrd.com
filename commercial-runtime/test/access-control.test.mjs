import test from "node:test";
import assert from "node:assert/strict";
import worker, { handleProjectRequest } from "../src/worker.mjs";

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


test("admin CORS preflight allows Authorization only from the configured public origin", async () => {
  const response = await worker.fetch(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals", {
    method: "OPTIONS",
    headers: {
      origin: "https://jadeltechrd.com",
      "access-control-request-method": "GET",
      "access-control-request-headers": "authorization",
    },
  }), { PUBLIC_ORIGIN: "https://jadeltechrd.com" });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://jadeltechrd.com");
  assert.equal(response.headers.get("access-control-allow-methods"), "GET,POST,OPTIONS");
  assert.equal(response.headers.get("access-control-allow-headers"), "authorization,content-type");
  assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
});

test("admin CORS preflight rejects an untrusted origin", async () => {
  const response = await worker.fetch(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals", {
    method: "OPTIONS",
    headers: {
      origin: "https://evil.example",
      "access-control-request-method": "GET",
      "access-control-request-headers": "authorization",
    },
  }), { PUBLIC_ORIGIN: "https://jadeltechrd.com" });

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("authenticated admin responses expose CORS only to the configured public origin", async () => {
  const db = {
    prepare() {
      return { all: async () => ({ results: [] }) };
    },
  };
  const response = await worker.fetch(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals", {
    headers: {
      origin: "https://jadeltechrd.com",
      authorization: "Bearer admin-secret-token",
    },
  }), {
    PUBLIC_ORIGIN: "https://jadeltechrd.com",
    ADMIN_API_TOKEN: "admin-secret-token",
    DB: db,
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://jadeltechrd.com");
  assert.equal(response.headers.get("access-control-allow-headers"), "authorization,content-type");
  assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
});
