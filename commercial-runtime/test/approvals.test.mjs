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
  assert.deepEqual(body.payments, []);
  assert.equal(queries.length, 2);
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

test("admin approval reconciles verified payment ledger to a project", async () => {
  const ledgerId = "123e4567-e89b-12d3-a456-426614174111";
  const projectId = "123e4567-e89b-12d3-a456-426614174000";
  const bound = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          bound.push({ sql, values });
          return {
            first: async () => {
              if (sql.includes("FROM payment_ledger")) {
                return { ledger_id: ledgerId, provider_event_id: "WH-456", ledger_state: "REQUIRES_HUMAN" };
              }
              if (sql.includes("FROM project_requests")) {
                return { project_id: projectId };
              }
              return null;
            }
          };
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
      ledger_id: ledgerId,
      project_id: projectId,
      approval_type: "payment_reconciliation",
      decision: "approved",
      reason: "PayPal event and client scope reviewed"
    }),
  }), envWithDb(db));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ledger_state, "MATCHED");
  assert.equal(bound.some((entry) => entry.values.includes("MATCHED")), true);
});

test("admin approval requires project id before matching payment ledger", async () => {
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
  }), envWithDb({
    batch: async () => {
      throw new Error("batch should not run without a project");
    }
  }));
  assert.equal(response.status, 400);
});

test("admin approval cannot match a reconciling payment ledger", async () => {
  const ledgerId = "123e4567-e89b-12d3-a456-426614174111";
  const projectId = "123e4567-e89b-12d3-a456-426614174000";
  let batched = false;
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            first: async () => {
              if (sql.includes("FROM payment_ledger")) {
                return {
                  ledger_id: ledgerId,
                  provider_event_id: "WH-PENDING",
                  ledger_state: "RECONCILING",
                };
              }
              throw new Error("project lookup should not run for a non-matchable ledger state");
            }
          };
        }
      };
    },
    batch: async () => {
      batched = true;
    }
  };
  const response = await handleAdminApprovals(new Request("https://intake.jadeltechrd.com/api/v1/admin/approvals", {
    method: "POST",
    headers: {
      authorization: "Bearer admin-secret-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ledger_id: ledgerId,
      project_id: projectId,
      approval_type: "payment_reconciliation",
      decision: "approved",
    }),
  }), envWithDb(db));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "LEDGER_STATE_NOT_MATCHABLE");
  assert.equal(batched, false);
});

test("admin approval rejects terminal payment ledger states", async () => {
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            first: async () => {
              if (sql.includes("FROM payment_ledger")) {
                return {
                  ledger_id: "123e4567-e89b-12d3-a456-426614174111",
                  provider_event_id: "WH-456",
                  ledger_state: "MATCHED",
                };
              }
              return { project_id: "123e4567-e89b-12d3-a456-426614174000" };
            }
          };
        }
      };
    },
    batch: async () => {
      throw new Error("batch should not run for terminal ledger states");
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
      decision: "approved",
    }),
  }), envWithDb(db));
  assert.equal(response.status, 409);
});
