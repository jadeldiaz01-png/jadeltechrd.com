import test from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstile } from "../src/worker.mjs";

test("Turnstile verification cannot be redirected by user input", async () => {
  let calledUrl = null;
  const fakeFetch = async (url) => {
    calledUrl = String(url);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const ok = await verifyTurnstile("https://attacker.invalid/internal", { TURNSTILE_SECRET_KEY: "server-secret" }, "203.0.113.10", fakeFetch);
  assert.equal(ok, true);
  assert.equal(calledUrl, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
});
