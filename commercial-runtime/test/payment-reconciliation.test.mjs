import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminPaymentReconciliation } from "../src/worker.mjs";

const PROJECT_ID = "123e4567-e89b-12d3-a456-426614174000";
const LEDGER_ID = "223e4567-e89b-12d3-a456-426614174000";
const ORDER_ID = "323e4567-e89b-12d3-a456-426614174000";
const QUOTE_ID = "423e4567-e89b-12d3-a456-426614174000";

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

function envFixture({
  verified=true,
  ledgerState="REQUIRES_HUMAN",
  ledgerProject=null,
  eventType="PAYMENT.CAPTURE.COMPLETED",
  amountUsd="250.00",
  currencyCode="USD",
  projectState="PAYMENT_PENDING",
  policyStatus="ALLOWED",
  orderProject=PROJECT_ID,
  orderStatus="PENDING",
  quoteStatus="ACCEPTED",
  orderAmountMinor=25000,
  orderCurrency="USD",
  settlementOrderId=ORDER_ID,
} = {}) {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM project_requests")) {
                return { project_id:PROJECT_ID, state:projectState, policy_status:policyStatus };
              }
              if (sql.includes("FROM payment_ledger l JOIN payment_events")) {
                return {
                  ledger_id:LEDGER_ID,
                  project_id:ledgerProject,
                  ledger_state:ledgerState,
                  provider_event_id:"paypal-event-1",
                  amount_usd:amountUsd,
                  currency_code:currencyCode,
                  verification_status:verified ? "VERIFIED" : "REJECTED",
                  event_type:eventType,
                };
              }
              if (sql.includes("FROM sales_settlements")) {
                return ledgerState === "MATCHED"
                  ? { settlement_id:"settlement-1", payment_order_id:settlementOrderId }
                  : null;
              }
              if (sql.includes("FROM payment_orders po JOIN quotes")) {
                return {
                  payment_order_id:ORDER_ID,
                  quote_id:QUOTE_ID,
                  project_id:orderProject,
                  status:orderStatus,
                  amount_minor:orderAmountMinor,
                  currency_code:orderCurrency,
                  quote_status:quoteStatus,
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

const matchedRequest = () => ({
  project_id:PROJECT_ID,
  ledger_id:LEDGER_ID,
  payment_order_id:ORDER_ID,
  decision:"MATCHED",
  reason:"completed PayPal event matched to accepted quote",
});

test("reconciliation rejects anonymous access", async () => {
  const env = envFixture();
  const response = await handleAdminPaymentReconciliation(request(matchedRequest(), "wrong"), env);
  assert.equal(response.status, 401);
});

test("settlement requires an explicit internal payment order", async () => {
  const env = envFixture();
  const response = await handleAdminPaymentReconciliation(request({
    project_id:PROJECT_ID,
    ledger_id:LEDGER_ID,
    decision:"MATCHED",
  }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "PAYMENT_ORDER_REQUIRED_FOR_SETTLEMENT");
  assert.equal(env.batches.length, 0);
});

test("completed verified payment settles only against accepted quote and pending order", async () => {
  const env = envFixture();
  const response = await handleAdminPaymentReconciliation(request(matchedRequest()), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ledger_state, "MATCHED");
  assert.equal(body.project_state, "PAID");
  assert.equal(body.payment_order_id, ORDER_ID);
  assert.equal(body.quote_id, QUOTE_ID);
  assert.equal(body.replayed, false);
  assert.equal(env.batches.length, 1);
  assert.equal(env.batches[0].length, 5);
});

test("RECONCILING payment ledger cannot become MATCHED", async () => {
  const env = envFixture({ ledgerState:"RECONCILING", eventType:"PAYMENT.CAPTURE.PENDING" });
  const response = await handleAdminPaymentReconciliation(request(matchedRequest()), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PAYMENT_LEDGER_NOT_SETTLEABLE");
  assert.equal(env.batches.length, 0);
});

test("unverified provider event cannot settle", async () => {
  const env = envFixture({ verified:false });
  const response = await handleAdminPaymentReconciliation(request(matchedRequest()), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PAYMENT_EVENT_NOT_VERIFIED");
  assert.equal(env.batches.length, 0);
});

test("non-completed provider event cannot settle even if ledger state is malformed", async () => {
  const env = envFixture({ eventType:"PAYMENT.CAPTURE.PENDING" });
  const response = await handleAdminPaymentReconciliation(request(matchedRequest()), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PAYMENT_EVENT_NOT_COMPLETED");
  assert.equal(env.batches.length, 0);
});

test("settlement amount must equal internal payment order amount", async () => {
  const env = envFixture({ amountUsd:"249.99" });
  const response = await handleAdminPaymentReconciliation(request(matchedRequest()), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PAYMENT_ORDER_AMOUNT_OR_CURRENCY_MISMATCH");
  assert.equal(env.batches.length, 0);
});

test("settlement currency must equal internal payment order currency", async () => {
  const env = envFixture({ currencyCode:"EUR" });
  const response = await handleAdminPaymentReconciliation(request(matchedRequest()), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PAYMENT_ORDER_AMOUNT_OR_CURRENCY_MISMATCH");
  assert.equal(env.batches.length, 0);
});

test("same ledger/project/payment order settlement is idempotent", async () => {
  const env = envFixture({ ledgerState:"MATCHED", ledgerProject:PROJECT_ID });
  const response = await handleAdminPaymentReconciliation(request(matchedRequest()), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.replayed, true);
  assert.equal(body.payment_order_id, ORDER_ID);
  assert.equal(env.batches.length, 0);
});

test("matched payment cannot be reassigned to another project", async () => {
  const env = envFixture({ ledgerState:"MATCHED", ledgerProject:"523e4567-e89b-12d3-a456-426614174000" });
  const response = await handleAdminPaymentReconciliation(request(matchedRequest()), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PAYMENT_LEDGER_ALREADY_MATCHED");
  assert.equal(env.batches.length, 0);
});
