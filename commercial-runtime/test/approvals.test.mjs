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
