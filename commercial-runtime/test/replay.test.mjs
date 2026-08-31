import test from "node:test";
import assert from "node:assert/strict";
import { handleProjectRequest } from "../src/worker.mjs";

test("same idempotency key replays existing request without a second batch write", async () => {
  let batchCalls = 0;
  const env = {
    PUBLIC_ORIGIN: "https://jadeltechrd.com",
    TURNSTILE_SECRET_KEY: "secret",
    PROJECT_REQUEST_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: {
      prepare() {
        return {
          bind() {
            return {
              first: async () => ({ project_id: "p-existing", state: "VALIDATED", policy_status: "PENDING" })
            };
          }
        };
      },
      batch: async () => { batchCalls += 1; }
    }
  };
  const request = new Request("https://jadeltechrd.com/api/v1/project-requests", {
    method: "POST",
    headers: {
      origin: "https://jadeltechrd.com",
      "content-type": "application/json",
      "idempotency-key": "1234567890abcdef"
    },
    body: JSON.stringify({
      name: "Cliente prueba",
      email: "client@example.com",
      service_ids: ["support"],
      turnstile_token: "token"
    })
  });
  const response = await handleProjectRequest(request, env, {
    fetchImpl: async () => new Response(JSON.stringify({ success: true }), { status: 200 })
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.project_id, "p-existing");
  assert.equal(body.replayed, true);
  assert.equal(batchCalls, 0);
});
