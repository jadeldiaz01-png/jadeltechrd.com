import test from "node:test";
import assert from "node:assert/strict";
import { handlePayPalWebhook } from "../src/worker.mjs";

const PROJECT_ID = "123e4567-e89b-12d3-a456-426614174000";
const QUOTE_ID = "423e4567-e89b-12d3-a456-426614174000";
const PAYMENT_ORDER_ID = "323e4567-e89b-12d3-a456-426614174000";
const PROVIDER_ORDER_ID = "PAYPAL-ORDER-123";
const CAPTURE_ID = "PAYPAL-CAPTURE-123";
const webhookHeaders = {
  "paypal-auth-algo":"SHA256withRSA",
  "paypal-cert-url":"https://api-m.paypal.com/certs/test.pem",
  "paypal-transmission-id":"transmission-1",
  "paypal-transmission-sig":"signature",
  "paypal-transmission-time":"2026-10-23T00:00:00Z",
};

const orderRow = (overrides = {}) => ({
  payment_order_id:PAYMENT_ORDER_ID,
  quote_id:QUOTE_ID,
  project_id:PROJECT_ID,
  status:"PENDING",
  amount_minor:25000,
  currency_code:"USD",
  provider_order_id:PROVIDER_ORDER_ID,
  quote_status:"ACCEPTED",
  project_state:"PAYMENT_PENDING",
  policy_status:"ALLOWED",
  ...overrides,
});

function paypalOrder(status, captureStatus = "COMPLETED") {
  return {
    id:PROVIDER_ORDER_ID,
    status,
    purchase_units:[{
      custom_id:PAYMENT_ORDER_ID,
      invoice_id:QUOTE_ID,
      amount:{ currency_code:"USD", value:"250.00" },
      payments:{ captures:[{
        id:CAPTURE_ID,
        status:captureStatus,
        amount:{ currency_code:"USD", value:"250.00" },
      }] },
    }],
  };
}

function webhookRequest(event) {
  return new Request("https://intake.jadeltechrd.com/api/v1/paypal/webhooks", {
    method:"POST",
    headers:webhookHeaders,
    body:JSON.stringify(event),
  });
}

function baseEnv(db, overrides = {}) {
  return {
    PAYPAL_ENVIRONMENT:"live",
    PAYPAL_CLIENT_ID:"test-client",
    PAYPAL_CLIENT_SECRET:"test-secret",
    PAYPAL_WEBHOOK_ID:"test-webhook",
    PAYPAL_ORDER_CREATION_ENABLED:"true",
    PAYPAL_LIVE_ORDER_CREATION_ENABLED:"true",
    PRODUCTION_AUTHORIZED:"true",
    MAX_AUTONOMOUS_CAPITAL_USD:"0",
    PAYPAL_AUTOMATIC_CAPTURE_MAX_MINOR:"50000",
    DB:db,
    ...overrides,
  };
}

function providerFetch({ orderStatus="APPROVED", captureStatus="COMPLETED", onCapture=()=>{} } = {}) {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url:String(url), options });
    if (String(url).endsWith("/v1/oauth2/token")) return Response.json({ access_token:"mock-access-token" });
    if (String(url).endsWith("/v1/notifications/verify-webhook-signature")) {
      return Response.json({ verification_status:"SUCCESS" });
    }
    if (String(url).endsWith(`/v2/checkout/orders/${PROVIDER_ORDER_ID}`)) {
      return Response.json(paypalOrder(orderStatus,captureStatus));
    }
    if (String(url).endsWith(`/v2/checkout/orders/${PROVIDER_ORDER_ID}/capture`)) {
      onCapture();
      return Response.json({ status:"COMPLETED", purchase_units:[{
        payments:{ captures:[{
          id:CAPTURE_ID,
          status:"COMPLETED",
          amount:{ currency_code:"USD", value:"250.00" },
        }] },
      }] });
    }
    throw new Error(`unexpected provider request ${url}`);
  };
  return { fetchImpl, requests };
}

function approvedOrderEvent(id = "EVENT-APPROVED-1") {
  return { id, event_type:"CHECKOUT.ORDER.APPROVED", resource:{ id:PROVIDER_ORDER_ID, status:"APPROVED" } };
}

function completedCaptureEvent(id = "EVENT-CAPTURE-1", overrides = {}) {
  return {
    id,
    event_type:"PAYMENT.CAPTURE.COMPLETED",
    resource:{
      id:CAPTURE_ID,
      status:"COMPLETED",
      amount:{ value:"250.00", currency_code:"USD" },
      supplementary_data:{ related_ids:{ order_id:PROVIDER_ORDER_ID } },
      ...overrides,
    },
  };
}

function orderLookupDb(row, { onBatch=()=>{} } = {}) {
  const batches = [];
  const db = {
    prepare(sql) {
      return { bind() { return {
        async all() {
          if (sql.includes("FROM payment_orders po JOIN quotes q")) return { results:[row] };
          if (sql.includes("FROM sales_settlements")) return { results:[] };
          return { results:[] };
        },
        async first() { return null; },
      }; } };
    },
    async batch(items) { batches.push(items); onBatch(items); return []; },
  };
  return { db, batches };
}

function settlementDb(row) {
  const state = { eventId:null, ledgerId:null, ledgerState:null, settlements:[], batches:[] };
  const db = {
    prepare(sql) {
      return { bind(...values) {
        const statement = { sql, values };
        Object.assign(statement, {
        async all() {
          if (sql.includes("FROM payment_orders po JOIN quotes q")) return { results:[row] };
          if (sql.includes("FROM sales_settlements")) {
            return { results:state.settlements.filter((item) =>
              item.payment_order_id === values[0] || item.ledger_id === values[1]) };
          }
          return { results:[] };
        },
        async first() {
          if (sql.includes("FROM payment_events WHERE provider_event_id")) {
            return state.eventId === values[0] ? { provider_event_id:state.eventId } : null;
          }
          if (sql.includes("FROM payment_ledger WHERE provider_event_id")) {
            return state.eventId === values[0] ? { ledger_id:state.ledgerId, ledger_state:state.ledgerState } : null;
          }
          return null;
        },
        });
        return statement;
      } };
    },
    async batch(items) {
      state.batches.push(items.length);
      if (items.length === 2) {
        if (state.eventId) throw new Error("duplicate provider event");
        state.ledgerId = items[1].values[0];
        state.eventId = items[1].values[1];
        state.ledgerState = "REQUIRES_HUMAN";
      } else if (items.length === 5) {
        const values = items[4].values;
        state.settlements.push({
          settlement_id:values[0],
          payment_order_id:values[1],
          ledger_id:values[2],
        });
        state.ledgerState = "MATCHED";
      }
      return [];
    },
  };
  return { db, state };
}

test("buyer-approved order is not captured unless the explicit feature flag and limit are set", async () => {
  let queriedOrders = false;
  let captured = false;
  const db = {
    prepare() { return { bind() { return { all:async () => { queriedOrders=true; return { results:[orderRow()] }; } }; } }; },
    async batch() { throw new Error("approval-only event must not write a payment ledger"); },
  };
  const provider = providerFetch({ onCapture:() => { captured=true; } });
  const response = await handlePayPalWebhook(webhookRequest(approvedOrderEvent()),baseEnv(db),{ fetchImpl:provider.fetchImpl });
  const body = await response.json();
  assert.equal(response.status,202);
  assert.equal(body.capture_performed,false);
  assert.equal(queriedOrders,false);
  assert.equal(captured,false);
  assert.equal(provider.requests.some((item) => item.url.endsWith("/capture")),false);
});

test("only a verified, approved, exact PayPal order is automatically captured", async () => {
  const { db } = orderLookupDb(orderRow());
  let captures = 0;
  const provider = providerFetch({ onCapture:() => { captures+=1; } });
  const response = await handlePayPalWebhook(
    webhookRequest(approvedOrderEvent()),
    baseEnv(db,{ PAYPAL_AUTOMATIC_CAPTURE_ENABLED:"true", FINANCIAL_EXECUTION_AUTHORIZED:"true" }),
    { fetchImpl:provider.fetchImpl },
  );
  const body = await response.json();
  assert.equal(response.status,202);
  assert.equal(body.capture_performed,true);
  assert.equal(captures,1);
  const captureRequest = provider.requests.find((item) => item.url.endsWith("/capture"));
  assert.equal(captureRequest.options.headers["paypal-request-id"],`jadel-capture-${PAYMENT_ORDER_ID}`);
});

test("automatic capture refuses orders above the configured per-order limit", async () => {
  const { db } = orderLookupDb(orderRow());
  const provider = providerFetch();
  const response = await handlePayPalWebhook(
    webhookRequest(approvedOrderEvent()),
    baseEnv(db,{ PAYPAL_AUTOMATIC_CAPTURE_ENABLED:"true", PAYPAL_AUTOMATIC_CAPTURE_MAX_MINOR:"24999", FINANCIAL_EXECUTION_AUTHORIZED:"true" }),
    { fetchImpl:provider.fetchImpl },
  );
  const body = await response.json();
  assert.equal(response.status,202);
  assert.equal(body.capture_performed,false);
  assert.equal(body.reason,"PAYMENT_ORDER_POLICY_REJECTED");
  assert.equal(provider.requests.some((item) => item.url.includes("/v2/checkout/orders/")),false);
});

test("automatic capture requires the independent financial-execution authorization", async () => {
  const { db } = orderLookupDb(orderRow());
  const provider = providerFetch();
  const response = await handlePayPalWebhook(
    webhookRequest(approvedOrderEvent()),
    baseEnv(db,{ PAYPAL_AUTOMATIC_CAPTURE_ENABLED:"true" }),
    { fetchImpl:provider.fetchImpl },
  );
  const body = await response.json();
  assert.equal(response.status,202);
  assert.equal(body.capture_performed,false);
  assert.equal(body.reason,"FINANCIAL_EXECUTION_NOT_AUTHORIZED");
  assert.equal(provider.requests.some((item) => item.url.endsWith("/capture")),false);
});

test("automatic capture refuses a PayPal order that is not buyer-approved", async () => {
  const { db } = orderLookupDb(orderRow());
  const provider = providerFetch({ orderStatus:"CREATED" });
  const response = await handlePayPalWebhook(
    webhookRequest(approvedOrderEvent()),
    baseEnv(db,{ PAYPAL_AUTOMATIC_CAPTURE_ENABLED:"true", FINANCIAL_EXECUTION_AUTHORIZED:"true" }),
    { fetchImpl:provider.fetchImpl },
  );
  const body = await response.json();
  assert.equal(response.status,202);
  assert.equal(body.capture_performed,false);
  assert.equal(body.reason,"PAYPAL_ORDER_NOT_APPROVED");
  assert.equal(provider.requests.some((item) => item.url.endsWith("/capture")),false);
});

test("verified completed capture is auto-reconciled once only when provider and D1 facts agree", async () => {
  const { db, state } = settlementDb(orderRow());
  const provider = providerFetch({ orderStatus:"COMPLETED" });
  const env = baseEnv(db,{ PAYPAL_AUTOMATIC_RECONCILIATION_ENABLED:"true" });
  const first = await handlePayPalWebhook(webhookRequest(completedCaptureEvent()),env,{ fetchImpl:provider.fetchImpl });
  const firstBody = await first.json();
  assert.equal(first.status,202);
  assert.equal(firstBody.ledger_state,"MATCHED");
  assert.equal(state.settlements.length,1);
  assert.deepEqual(state.batches,[2,5]);

  const replay = await handlePayPalWebhook(webhookRequest(completedCaptureEvent()),env,{ fetchImpl:provider.fetchImpl });
  const replayBody = await replay.json();
  assert.equal(replay.status,200);
  assert.equal(replayBody.replayed,true);
  assert.equal(state.settlements.length,1);
  assert.deepEqual(state.batches,[2,5,2]);
});

test("automatic reconciliation leaves amount mismatches for human review", async () => {
  const { db, state } = settlementDb(orderRow());
  const provider = providerFetch({ orderStatus:"COMPLETED" });
  const response = await handlePayPalWebhook(
    webhookRequest(completedCaptureEvent("EVENT-WRONG-AMOUNT",{ amount:{ value:"249.99", currency_code:"USD" } })),
    baseEnv(db,{ PAYPAL_AUTOMATIC_RECONCILIATION_ENABLED:"true" }),
    { fetchImpl:provider.fetchImpl },
  );
  const body = await response.json();
  assert.equal(response.status,202);
  assert.equal(body.ledger_state,"REQUIRES_HUMAN");
  assert.deepEqual(state.batches,[2]);
  assert.equal(state.settlements.length,0);
  assert.equal(provider.requests.some((item) => item.url.includes("/v2/checkout/orders/")),false);
});
