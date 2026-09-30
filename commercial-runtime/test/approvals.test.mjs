import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminApprovals } from "../src/worker.mjs";

function envWithDb(db = {}) {
  return { ADMIN_API_TOKEN: "admin-secret-token", DB: db };
}

test("admin approvals fail closed when admin token is not configured", async () => {
  const response = await handleAdminApprovals(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals"));
  assert.equal(response.status, 503);
});

test("admin approvals reject anonymous access", async () => {
  const response = await handleAdminApprovals(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals"), envWithDb());
  assert.equal(response.status, 401);
});

test("admin approvals list pending projects and payment ledger with bearer token", async () => {
  const queries = [];
  const db = {
    prepare(sql) {
      queries.push(sql);
      return { all: async () => ({ results: [] }) };
    }
  };
  const response = await handleAdminApprovals(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals", {
    headers: { authorization: "Bearer admin-secret-token" },
  }), envWithDb(db));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.projects, []);
  assert.deepEqual(body.quotable_projects, []);
  assert.deepEqual(body.quotes, []);
  assert.deepEqual(body.payments, []);
  assert.deepEqual(body.payment_orders, []);
  assert.equal(queries.length, 5);
});

test("admin approvals can query an exact payment and order including terminal states", async () => {
  const CAPTURE_ID = "7AB12345CD678901E";
  const ORDER_ID = "323e4567-e89b-12d3-a456-426614174000";
  const seen = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          seen.push({ sql, values });
          return {
            all: async () => {
              if (sql.includes("FROM payment_ledger")) {
                return { results: [{
                  ledger_id:"223e4567-e89b-12d3-a456-426614174000",
                  provider_event_id:"paypal-event-1",
                  ledger_state:"MATCHED",
                  resource_id:CAPTURE_ID,
                  event_type:"PAYMENT.CAPTURE.COMPLETED",
                }] };
              }
              if (sql.includes("FROM payment_orders")) {
                return { results: [{
                  payment_order_id:ORDER_ID,
                  project_id:"123e4567-e89b-12d3-a456-426614174000",
                  status:"COMPLETED",
                }] };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
  const response = await handleAdminApprovals(new Request(
    `https://intake.jadeltechrd.com/api/v1/admin/approvals?capture_id=${CAPTURE_ID}&payment_order_id=${ORDER_ID}`,
    { headers: { authorization: "Bearer admin-secret-token" } },
  ), envWithDb(db));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.payments[0].ledger_state, "MATCHED");
  assert.equal(body.payment_orders[0].status, "COMPLETED");
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0].values, [CAPTURE_ID]);
  assert.deepEqual(seen[1].values, [ORDER_ID]);
});

test("admin exact payment lookup fails closed on partial or malformed identifiers", async () => {
  let touchedDb = false;
  const db = {
    prepare() {
      touchedDb = true;
      throw new Error("invalid lookup must not query");
    },
  };
  const response = await handleAdminApprovals(new Request(
    "https://intake.jadeltechrd.com/api/v1/admin/approvals?capture_id=bad!",
    { headers: { authorization: "Bearer admin-secret-token" } },
  ), envWithDb(db));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_PAYMENT_LOOKUP");
  assert.equal(touchedDb, false);
});

test("admin approval records evidence and promotes only to policy allowed", async () => {
  const bound = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          bound.push({ sql, values });
          return { first: async () => ({ project_id: "123e4567-e89b-12d3-a456-426614174000" }) };
        }
      };
    },
    batch: async (items) => {
      assert.equal(items.length, 2);
    }
  };
  const response = await handleAdminApprovals(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals", {
    method: "POST",
    headers: {
      authorization: "Bearer admin-secret-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      project_id: "123e4567-e89b-12d3-a456-426614174000",
      approval_type: "policy",
      decision: "approved",
      reason: "manual evidence reviewed"
    }),
  }), envWithDb(db));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.state, "POLICY_ALLOWED");
  assert.equal(body.policy_status, "ALLOWED");
  assert.equal(bound.some((entry) => entry.values.includes("APPROVED")), true);
});

test("admin approval rejects missing project ids before recording evidence", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return { first: async () => null };
        }
      };
    },
    batch: async () => {
      throw new Error("batch should not run for unknown projects");
    }
  };
  const response = await handleAdminApprovals(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals", {
    method: "POST",
    headers: {
      authorization: "Bearer admin-secret-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      project_id: "123e4567-e89b-12d3-a456-426614174999",
      decision: "approved",
    }),
  }), envWithDb(db));
  assert.equal(response.status, 404);
});

test("generic admin approval cannot bypass the sales-to-cash settlement contract", async () => {
  let touchedDb = false;
  const db = {
    prepare() {
      touchedDb = true;
      throw new Error("payment approval must not query the ledger");
    },
    batch: async () => {
      touchedDb = true;
      throw new Error("payment approval must not write the ledger");
    }
  };
  const response = await handleAdminApprovals(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals", {
    method: "POST",
    headers: {
      authorization: "Bearer admin-secret-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ledger_id: "123e4567-e89b-12d3-a456-426614174111",
      project_id: "123e4567-e89b-12d3-a456-426614174000",
      approval_type: "payment_reconciliation",
      decision: "approved",
    }),
  }), envWithDb(db));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "USE_PAYMENT_RECONCILIATION_CONTRACT");
  assert.equal(touchedDb, false);
});

test("generic admin approval still requires a project before a payment match attempt", async () => {
  const response = await handleAdminApprovals(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals", {
    method: "POST",
    headers: {
      authorization: "Bearer admin-secret-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ledger_id: "123e4567-e89b-12d3-a456-426614174111",
      approval_type: "payment_reconciliation",
      decision: "approved",
    }),
  }), envWithDb({}));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "PROJECT_REQUIRED_FOR_PAYMENT_MATCH");
});
