import test from "node:test";
import assert from "node:assert/strict";
import {
  handleAdminQuoteCreate,
  handleAdminQuoteAcceptance,
  handleAdminPaymentOrderCreate,
} from "../src/worker.mjs";

const PROJECT_ID = "123e4567-e89b-12d3-a456-426614174000";
const QUOTE_ID = "223e4567-e89b-12d3-a456-426614174000";

function adminRequest(path, body) {
  return new Request(`https://intake.jadeltechrd.com${path}`, {
    method:"POST",
    headers:{
      authorization:"Bearer admin-secret-token",
      "content-type":"application/json",
    },
    body:JSON.stringify(body),
  });
}

test("quote creation is server-priced and promotes only an allowed project to QUOTED", async () => {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM project_requests")) {
                return { project_id:PROJECT_ID, state:"POLICY_ALLOWED", policy_status:"ALLOWED" };
              }
              if (sql.includes("MAX(version)")) return { version:0 };
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
  const response = await handleAdminQuoteCreate(adminRequest("/api/v1/admin/quotes", {
    project_id:PROJECT_ID,
    currency_code:"USD",
    items:[
      { service_id:"architecture", description:"Agentic Blueprint", quantity:1, unit_amount_minor:25000 },
      { service_id:"support", description:"Support setup", quantity:1, unit_amount_minor:90000 },
    ],
  }), { ADMIN_API_TOKEN:"admin-secret-token", DB:db });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.status, "ISSUED");
  assert.equal(body.total_amount_minor, 115000);
  assert.equal(body.external_side_effect, false);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 4);
});

test("quote creation rejects projects without ALLOWED policy", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return { first: async () => ({ project_id:PROJECT_ID, state:"POLICY_CHECK", policy_status:"REQUIRES_HUMAN" }) };
        },
      };
    },
    batch: async () => { throw new Error("must not write"); },
  };
  const response = await handleAdminQuoteCreate(adminRequest("/api/v1/admin/quotes", {
    project_id:PROJECT_ID,
    items:[{ service_id:"architecture", quantity:1, unit_amount_minor:25000 }],
  }), { ADMIN_API_TOKEN:"admin-secret-token", DB:db });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PROJECT_NOT_QUOTABLE");
});

test("quote acceptance requires durable evidence and promotes to CUSTOMER_APPROVED", async () => {
  const batches = [];
  const db = {
    prepare() {
      return {
        bind() {
          return {
            first: async () => ({
              quote_id:QUOTE_ID,
              project_id:PROJECT_ID,
              status:"ISSUED",
              project_state:"QUOTED",
              policy_status:"ALLOWED",
            }),
          };
        },
      };
    },
    async batch(items) { batches.push(items); return []; },
  };
  const response = await handleAdminQuoteAcceptance(adminRequest("/api/v1/admin/quotes/accept", {
    quote_id:QUOTE_ID,
    acceptance_evidence:"customer confirmed quote by reviewed email thread",
  }), { ADMIN_API_TOKEN:"admin-secret-token", DB:db });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.quote_status, "ACCEPTED");
  assert.equal(body.project_state, "CUSTOMER_APPROVED");
  assert.equal(batches[0].length, 3);
});

test("payment order is internal-only and promotes accepted quote to PAYMENT_PENDING", async () => {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM quotes q JOIN project_requests")) {
                return {
                  quote_id:QUOTE_ID,
                  project_id:PROJECT_ID,
                  status:"ACCEPTED",
                  currency_code:"USD",
                  total_amount_minor:25000,
                  project_state:"CUSTOMER_APPROVED",
                  policy_status:"ALLOWED",
                };
              }
              if (sql.includes("FROM payment_orders")) return null;
              return null;
            },
          };
        },
      };
    },
    async batch(items) { batches.push(items); return []; },
  };
  const response = await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders", {
    quote_id:QUOTE_ID,
  }), { ADMIN_API_TOKEN:"admin-secret-token", DB:db });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.status, "PENDING");
  assert.equal(body.amount_minor, 25000);
  assert.equal(body.provider_call_performed, false);
  assert.equal(body.financial_execution_authorized, false);
  assert.equal(batches[0].length, 2);
});


test("expired quote cannot be accepted and is marked EXPIRED", async () => {
  const runs = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              return {
                quote_id:QUOTE_ID,
                project_id:PROJECT_ID,
                status:"ISSUED",
                expires_at:"2020-01-01T00:00:00.000Z",
                project_state:"QUOTED",
                policy_status:"ALLOWED",
              };
            },
            async run() {
              runs.push({ sql, values });
              return {};
            },
          };
        },
      };
    },
    batch: async () => { throw new Error("expired quote must not be accepted"); },
  };
  const response = await handleAdminQuoteAcceptance(adminRequest("/api/v1/admin/quotes/accept", {
    quote_id:QUOTE_ID,
    acceptance_evidence:"late acceptance",
  }), { ADMIN_API_TOKEN:"admin-secret-token", DB:db });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "QUOTE_EXPIRED");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].sql.includes("status='EXPIRED'"), true);
});

test("concurrent payment-order insert race returns existing order instead of duplicating", async () => {
  const existingOrderId = "323e4567-e89b-12d3-a456-426614174000";
  let paymentOrderLookups = 0;
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM quotes q JOIN project_requests")) {
                return {
                  quote_id:QUOTE_ID,
                  project_id:PROJECT_ID,
                  status:"ACCEPTED",
                  currency_code:"USD",
                  total_amount_minor:25000,
                  project_state:"CUSTOMER_APPROVED",
                  policy_status:"ALLOWED",
                };
              }
              if (sql.includes("FROM payment_orders")) {
                paymentOrderLookups += 1;
                return paymentOrderLookups === 1
                  ? null
                  : { payment_order_id:existingOrderId, status:"PENDING" };
              }
              return null;
            },
          };
        },
      };
    },
    async batch() {
      throw new Error("UNIQUE constraint failed: payment_orders.quote_id");
    },
  };
  const response = await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders", {
    quote_id:QUOTE_ID,
  }), { ADMIN_API_TOKEN:"admin-secret-token", DB:db });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "PAYMENT_ORDER_ALREADY_EXISTS");
  assert.equal(body.payment_order_id, existingOrderId);
});


test("sandbox-gated payment order creates a PayPal order without capture", async () => {
  const batches = [];
  const updates = [];
  const seen = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("FROM quotes q JOIN project_requests")) {
                return {
                  quote_id:QUOTE_ID,
                  project_id:PROJECT_ID,
                  status:"ACCEPTED",
                  currency_code:"USD",
                  total_amount_minor:25000,
                  project_state:"CUSTOMER_APPROVED",
                  policy_status:"ALLOWED",
                };
              }
              if (sql.includes("FROM payment_orders")) return null;
              return null;
            },
            async run() {
              updates.push({ sql, values });
              return {};
            },
          };
        },
      };
    },
    async batch(items) { batches.push(items); return []; },
  };

  const response = await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders", {
    quote_id:QUOTE_ID,
  }), {
    ADMIN_API_TOKEN:"admin-secret-token",
    DB:db,
    PAYPAL_ORDER_CREATION_ENABLED:"true",
    PAYPAL_ENVIRONMENT:"sandbox",
    PAYPAL_CLIENT_ID:"sandbox-client",
    PAYPAL_CLIENT_SECRET:"sandbox-secret",
  }, {
    fetchImpl: async (url, options = {}) => {
      seen.push({ url:String(url), options });
      if (String(url).endsWith("/v1/oauth2/token")) {
        return Response.json({ access_token:"sandbox-token" });
      }
      if (String(url).endsWith("/v2/checkout/orders")) {
        const body = JSON.parse(options.body);
        assert.equal(body.intent, "CAPTURE");
        assert.equal(body.purchase_units[0].amount.value, "250.00");
        assert.equal(body.purchase_units[0].amount.currency_code, "USD");
        return Response.json({
          id:"PAYPAL-ORDER-123",
          status:"CREATED",
          links:[{
            rel:"payer-action",
            href:"https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123",
          }],
        }, { status:201 });
      }
      throw new Error("unexpected provider URL");
    },
  });

  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.provider_order_id, "PAYPAL-ORDER-123");
  assert.equal(body.provider_call_performed, true);
  assert.equal(body.provider_environment, "sandbox");
  assert.equal(body.capture_performed, false);
  assert.equal(body.financial_execution_authorized, false);
  assert.match(body.approval_url, /^https:\/\/www\.sandbox\.paypal\.com\//);
  assert.equal(batches.length, 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].values[0], "PAYPAL-ORDER-123");
  assert.equal(seen.some((entry) => entry.url.endsWith("/v2/checkout/orders")), true);
  const orderRequest = seen.find((entry) => entry.url.endsWith("/v2/checkout/orders"));
  assert.match(orderRequest.options.headers["paypal-request-id"], /^[0-9a-f-]{36}$/i);
});

test("PayPal order creation flag cannot be enabled against live environment", async () => {
  let wrote = false;
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM quotes q JOIN project_requests")) {
                return {
                  quote_id:QUOTE_ID,
                  project_id:PROJECT_ID,
                  status:"ACCEPTED",
                  currency_code:"USD",
                  total_amount_minor:25000,
                  project_state:"CUSTOMER_APPROVED",
                  policy_status:"ALLOWED",
                };
              }
              return null;
            },
          };
        },
      };
    },
    async batch() { wrote = true; return []; },
  };
  const response = await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders", {
    quote_id:QUOTE_ID,
  }), {
    ADMIN_API_TOKEN:"admin-secret-token",
    DB:db,
    PAYPAL_ORDER_CREATION_ENABLED:"true",
    PAYPAL_ENVIRONMENT:"live",
    PAYPAL_CLIENT_ID:"live-client",
    PAYPAL_CLIENT_SECRET:"live-secret",
  });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "PAYPAL_ORDER_CREATION_SANDBOX_ONLY");
  assert.equal(wrote, false);
});
