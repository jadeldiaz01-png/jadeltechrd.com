import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminRevenueIntelligence } from "../src/worker.mjs";

function envWith(values = [0,0,0,0,0]) {
  let index = 0;
  return {
    ADMIN_API_TOKEN:"admin-secret-token",
    DB:{
      prepare() {
        return { first: async () => ({ value: values[index++] ?? 0 }) };
      }
    }
  };
}

test("revenue intelligence endpoint fails closed without admin configuration", async () => {
  const response = await handleAdminRevenueIntelligence(
    new Request("https://intake.jadeltechrd.com/api/v1/admin/revenue-intelligence"),
    {}
  );
  assert.equal(response.status, 503);
});

test("revenue intelligence endpoint rejects anonymous access", async () => {
  const response = await handleAdminRevenueIntelligence(
    new Request("https://intake.jadeltechrd.com/api/v1/admin/revenue-intelligence"),
    envWith()
  );
  assert.equal(response.status, 401);
});

test("revenue intelligence endpoint is GET-only and aggregate recommend-only", async () => {
  const env = envWith([10,3,2,1,900]);
  const request = new Request("https://intake.jadeltechrd.com/api/v1/admin/revenue-intelligence", {
    headers:{ authorization:"Bearer admin-secret-token" }
  });
  const response = await handleAdminRevenueIntelligence(request, env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.summary.total_requests, 10);
  assert.equal(body.summary.pending_policy_reviews, 3);
  assert.equal(body.summary.qualified_leads, 2);
  assert.equal(body.summary.converted_customers, 1);
  assert.equal(body.summary.reconciled_usd_revenue, 900);
  assert.equal(body.authority, "RECOMMEND_ONLY");
  assert.equal(body.production_authorized, false);
  assert.equal(body.recommendation.external_side_effects_authorized, false);
  assert.equal(JSON.stringify(body).includes("email"), false);
  assert.equal(JSON.stringify(body).includes("phone"), false);
});

test("revenue intelligence endpoint rejects writes", async () => {
  const response = await handleAdminRevenueIntelligence(
    new Request("https://intake.jadeltechrd.com/api/v1/admin/revenue-intelligence", {
      method:"POST",
      headers:{ authorization:"Bearer admin-secret-token", "content-type":"application/json" },
      body:"{}"
    }),
    envWith()
  );
  assert.equal(response.status, 405);
});
