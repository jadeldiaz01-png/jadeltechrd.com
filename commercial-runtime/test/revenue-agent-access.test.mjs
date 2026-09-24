import test from "node:test";
import assert from "node:assert/strict";
import {
  handleRevenueAgentOpportunities,
  handleRevenueRuntimeAuthorization,
} from "../src/worker.mjs";

const AGENT_TOKEN = "agent-test-value";
const ADMIN_TOKEN = "admin-test-value";

function envFixture() {
  return {
    DB:{
      prepare() {
        return {
          bind() {
            return { all:async () => ({ results:[] }) };
          }
        };
      }
    },
    ADMIN_API_TOKEN:ADMIN_TOKEN,
    REVENUE_AGENT_API_TOKEN:AGENT_TOKEN,
    REVENUE_RUNTIME_HMAC_KEY:"0123456789abcdef0123456789abcdef",
  };
}

function bearer(url, token, method="GET", body=null) {
  const options = { method, headers:{ authorization:`Bearer ${token}` } };
  if (body !== null) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  return new Request(url, options);
}

test("agent endpoint fails closed when dedicated token is not configured", async () => {
  const env = envFixture();
  delete env.REVENUE_AGENT_API_TOKEN;
  const response = await handleRevenueAgentOpportunities(
    bearer("https://intake.jadeltechrd.com/api/v1/revenue-agent/opportunities", AGENT_TOKEN),
    env,
  );
  assert.equal(response.status, 503);
});

test("admin token cannot authenticate revenue agent opportunity feed", async () => {
  const response = await handleRevenueAgentOpportunities(
    bearer("https://intake.jadeltechrd.com/api/v1/revenue-agent/opportunities", ADMIN_TOKEN),
    envFixture(),
  );
  assert.equal(response.status, 401);
});

test("dedicated agent token can read non-PII opportunity feed", async () => {
  const response = await handleRevenueAgentOpportunities(
    bearer("https://intake.jadeltechrd.com/api/v1/revenue-agent/opportunities", AGENT_TOKEN),
    envFixture(),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.pii_included, false);
  assert.equal(body.production_execution_authorized, false);
});

test("admin token cannot request runtime authorization", async () => {
  const response = await handleRevenueRuntimeAuthorization(
    bearer(
      "https://intake.jadeltechrd.com/api/v1/revenue-agent/authorization",
      ADMIN_TOKEN,
      "POST",
      {},
    ),
    envFixture(),
  );
  assert.equal(response.status, 401);
});
