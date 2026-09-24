import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminPaymentReconciliation } from "../src/worker.mjs";

const PROJECT_ID = "123e4567-e89b-12d3-a456-426614174000";
const LEDGER_ID = "223e4567-e89b-12d3-a456-426614174000";

function request(body, token = "admin-secret-token") {
  return new Request("https://intake.jadeltechrd.com/api/v1/admin/payments/reconcile", {
    method:"POST",
    headers:{
      authorization:`Bearer ${token}`,
      "content-type":"application/json",
    },
    body:JSON.stringify(body),
  });
}

function envFixture({ verified=true, ledgerState="REQUIRES_HUMAN", ledgerProject=null } = {}) {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("FROM project_requests")) return { project_id:PROJECT_ID };
              if (sql.includes("FROM payment_ledger l JOIN payment_events")) {
                return {
                  ledger_id:LEDGER_ID,
                  project_id:ledgerProject,
                  ledger_state:ledgerState,
                  provider_event_id:"paypal-event-1",
                  verification_status:verified ? "VERIFIED" : "REJECTED",
                };
              }
              return null;
            },
          };
        },
      };
    },
    async batch(items) {
      batches.push(items);
      return [];
    },
  };
  return { ADMIN_API_TOKEN:"admin-secret-token", DB:db, batches };
}

test("reconciliation rejects anonymous access", async () => {
  const env = envFixture();
  const response = await handleAdminPaymentReconciliation(
    request({ project_id:PROJECT_ID, ledger_id:LEDGER_ID, decision:"MATCHED" }, "wrong"),
    env,
  );
  assert.equal(response.status, 401);
});

test("verified payment can be human-matched to a project", async () => {
  const env = envFixture();
  const response = await handleAdminPaymentReconciliation(
    request({
      project_id:PROJECT_ID,
      ledger_id:LEDGER_ID,
      decision:"MATCHED",
      reason:"PayPal evidence reviewed",
    }),
    env,
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ledger_state, "MATCHED");
  assert.equal(body.project_id, PROJECT_ID);
  assert.equal(body.replayed, false);
  assert.equal(env.batches.length, 1);
  assert.equal(env.batches[0].length, 2);
});

test("unverified provider event cannot be reconciled", async () => {
  const env = envFixture({ verified:false });
  const response = await handleAdminPaymentReconciliation(
    request({ project_id:PROJECT_ID, ledger_id:LEDGER_ID, decision:"MATCHED" }),
    env,
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PAYMENT_EVENT_NOT_VERIFIED");
  assert.equal(env.batches.length, 0);
});

test("same matched ledger/project is idempotent", async () => {
  const env = envFixture({ ledgerState:"MATCHED", ledgerProject:PROJECT_ID });
  const response = await handleAdminPaymentReconciliation(
    request({ project_id:PROJECT_ID, ledger_id:LEDGER_ID, decision:"MATCHED" }),
    env,
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.replayed, true);
  assert.equal(env.batches.length, 0);
});

test("matched payment cannot be reassigned", async () => {
  const env = envFixture({ ledgerState:"MATCHED", ledgerProject:"323e4567-e89b-12d3-a456-426614174000" });
  const response = await handleAdminPaymentReconciliation(
    request({ project_id:PROJECT_ID, ledger_id:LEDGER_ID, decision:"MATCHED" }),
    env,
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PAYMENT_LEDGER_ALREADY_MATCHED");
});
