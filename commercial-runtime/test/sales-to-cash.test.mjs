import test from "node:test";
import assert from "node:assert/strict";
import {
  handleAdminQuoteCreate,
  handleAdminCatalogQuoteCreate,
  handleAdminQuoteAcceptance,
  handleAdminQuoteAcceptanceReadiness,
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

test("catalog quote derives amounts from selected project services", async () => {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("service_ids_json")) {
                return {
                  project_id:PROJECT_ID,
                  service_ids_json:'["architecture","analytics"]',
                  state:"POLICY_ALLOWED",
                  policy_status:"ALLOWED",
                };
              }
              if (sql.includes("MAX(version)")) return { version:0 };
              return null;
            },
          };
        },
      };
    },
    async batch(items) { batches.push(items); return []; },
  };
  const response = await handleAdminCatalogQuoteCreate(adminRequest("/api/v1/admin/quotes/from-catalog", {
    project_id:PROJECT_ID,
  }), { ADMIN_API_TOKEN:"admin-secret-token", DB:db });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.quote_source, "CANONICAL_SERVICE_CATALOG");
  assert.equal(body.total_amount_minor, 90000);
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

function readinessRequest(quoteId = QUOTE_ID, method = "GET", authenticated = true) {
  return new Request(`https://intake.jadeltechrd.com/api/v1/admin/quotes/acceptance-readiness?quote_id=${quoteId}`, {
    method,
    headers: authenticated ? { authorization:"Bearer admin-secret-token" } : {},
  });
}

test("quote acceptance readiness is authenticated, GET-only, and read-only", async () => {
  let batchCalls = 0;
  let runCalls = 0;
  const db = {
    prepare(sql) {
      assert.match(sql, /^SELECT /);
      return {
        bind(value) {
          assert.equal(value, QUOTE_ID);
          return {
            first: async () => ({
              quote_id:QUOTE_ID,
              project_id:PROJECT_ID,
              status:"ISSUED",
              expires_at:null,
              project_state:"QUOTED",
              policy_status:"ALLOWED",
            }),
          };
        },
      };
    },
    async batch() { batchCalls += 1; throw new Error("unexpected batch"); },
    async run() { runCalls += 1; throw new Error("unexpected run"); },
  };

  const unauthorized = await handleAdminQuoteAcceptanceReadiness(
    readinessRequest(QUOTE_ID, "GET", false),
    { ADMIN_API_TOKEN:"admin-secret-token", DB:db },
  );
  assert.equal(unauthorized.status, 401);

  const wrongMethod = await handleAdminQuoteAcceptanceReadiness(
    readinessRequest(QUOTE_ID, "POST", true),
    { ADMIN_API_TOKEN:"admin-secret-token", DB:db },
  );
  assert.equal(wrongMethod.status, 405);

  const response = await handleAdminQuoteAcceptanceReadiness(
    readinessRequest(),
    { ADMIN_API_TOKEN:"admin-secret-token", DB:db },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ready, true);
  assert.equal(body.code, "QUOTE_ACCEPTANCE_READY");
  assert.equal(body.quote_status, "ISSUED");
  assert.equal(body.project_state, "QUOTED");
  assert.equal(body.policy_status, "ALLOWED");
  assert.equal(body.expired, false);
  assert.equal(batchCalls, 0);
  assert.equal(runCalls, 0);
  assert.equal("acceptance_evidence" in body, false);
});

test("quote acceptance readiness reports non-ready states without mutation", async () => {
  const cases = [
    [{ status:"ACCEPTED", project_state:"QUOTED", policy_status:"ALLOWED", expires_at:null }, "QUOTE_NOT_ISSUED"],
    [{ status:"ISSUED", project_state:"QUOTED", policy_status:"DENIED", expires_at:null }, "POLICY_NOT_ALLOWED"],
    [{ status:"ISSUED", project_state:"CUSTOMER_APPROVED", policy_status:"ALLOWED", expires_at:null }, "PROJECT_STATE_NOT_ACCEPTABLE"],
    [{ status:"ISSUED", project_state:"QUOTED", policy_status:"ALLOWED", expires_at:"2000-01-01T00:00:00.000Z" }, "QUOTE_EXPIRED"],
  ];

  for (const [fields, expectedCode] of cases) {
    let writes = 0;
    const db = {
      prepare(sql) {
        assert.match(sql, /^SELECT /);
        return {
          bind() {
            return {
              first: async () => ({
                quote_id:QUOTE_ID,
                project_id:PROJECT_ID,
                ...fields,
              }),
              run: async () => { writes += 1; },
            };
          },
        };
      },
      batch: async () => { writes += 1; },
    };
    const response = await handleAdminQuoteAcceptanceReadiness(
      readinessRequest(),
      { ADMIN_API_TOKEN:"admin-secret-token", DB:db },
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ready, false);
    assert.equal(body.code, expectedCode);
    assert.equal(writes, 0);
  }
});

test("quote acceptance readiness returns safe not-found and validates quote id", async () => {
  let queries = 0;
  const db = {
    prepare(sql) {
      queries += 1;
      assert.match(sql, /^SELECT /);
      return { bind: () => ({ first: async () => null }) };
    },
  };

  const missing = await handleAdminQuoteAcceptanceReadiness(
    readinessRequest(),
    { ADMIN_API_TOKEN:"admin-secret-token", DB:db },
  );
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { ready:false, code:"QUOTE_NOT_FOUND", quote_id:QUOTE_ID });

  const beforeInvalid = queries;
  const invalid = await handleAdminQuoteAcceptanceReadiness(
    readinessRequest("not-a-uuid"),
    { ADMIN_API_TOKEN:"admin-secret-token", DB:db },
  );
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, "INVALID_QUOTE_ID");
  assert.equal(queries, beforeInvalid);
});

test("quote acceptance persistence failure returns only the safe error contract", async () => {
  const evidence = "customer confirmed quote by reviewed email thread";
  const db = {
    prepare() {
      return {
        bind() {
          return {
            first: async () => ({
              quote_id:QUOTE_ID,
              project_id:PROJECT_ID,
              status:"ISSUED",
              expires_at:null,
              project_state:"QUOTED",
              policy_status:"ALLOWED",
            }),
          };
        },
      };
    },
    async batch() {
      const error = new Error("internal database detail");
      error.name = "D1BatchError";
      throw error;
    },
  };

  const captured = [];
  const originalError = console.error;
  console.error = (...args) => captured.push(args);
  try {
    const response = await handleAdminQuoteAcceptance(adminRequest("/api/v1/admin/quotes/accept", {
      quote_id:QUOTE_ID,
      acceptance_evidence:evidence,
    }), { ADMIN_API_TOKEN:"admin-secret-token", DB:db });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error:"QUOTE_ACCEPTANCE_PERSISTENCE_FAILED" });
  } finally {
    console.error = originalError;
  }

  const serializedLogs = JSON.stringify(captured);
  assert.equal(serializedLogs.includes(evidence), false);
  assert.equal(serializedLogs.includes("internal database detail"), false);
  assert.match(serializedLogs, /quote_acceptance_persistence_failed/);
  assert.match(serializedLogs, /D1BatchError/);
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
        assert.equal(body.purchase_units[0].custom_id, options.headers["paypal-request-id"]);
        assert.equal(body.purchase_units[0].invoice_id, QUOTE_ID);
        return Response.json({
          id:"PAYPAL-ORDER-123",
          status:"PAYER_ACTION_REQUIRED",
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
  assert.equal(body.provider_status, "PAYER_ACTION_REQUIRED");
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

function livePaymentOrderFixture() {
  const batches = [];
  const updates = [];
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
    async batch(items) {
      batches.push(items);
      return [];
    },
  };
  return { db, batches, updates };
}

test("live PayPal order creation remains disabled without dedicated live gate", async () => {
  const { db, batches } = livePaymentOrderFixture();
  let fetched = false;
  const response = await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders", {
    quote_id:QUOTE_ID,
  }), {
    ADMIN_API_TOKEN:"admin-secret-token",
    DB:db,
    PAYPAL_ORDER_CREATION_ENABLED:"true",
    PAYPAL_ENVIRONMENT:"live",
    PAYPAL_CLIENT_ID:"live-client",
    PAYPAL_CLIENT_SECRET:"live-secret",
    PRODUCTION_AUTHORIZED:"true",
    MAX_AUTONOMOUS_CAPITAL_USD:"0",
  }, {
    fetchImpl: async () => {
      fetched = true;
      throw new Error("provider must not be called");
    },
  });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "PAYPAL_LIVE_ORDER_CREATION_DISABLED");
  assert.equal(fetched, false);
  assert.equal(batches.length, 0);
});

test("live PayPal order creation remains disabled while production authorization is false", async () => {
  const { db, batches } = livePaymentOrderFixture();
  let fetched = false;
  const response = await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders", {
    quote_id:QUOTE_ID,
  }), {
    ADMIN_API_TOKEN:"admin-secret-token",
    DB:db,
    PAYPAL_ORDER_CREATION_ENABLED:"true",
    PAYPAL_LIVE_ORDER_CREATION_ENABLED:"true",
    PAYPAL_ENVIRONMENT:"live",
    PAYPAL_CLIENT_ID:"live-client",
    PAYPAL_CLIENT_SECRET:"live-secret",
    PRODUCTION_AUTHORIZED:"false",
    MAX_AUTONOMOUS_CAPITAL_USD:"0",
  }, {
    fetchImpl: async () => {
      fetched = true;
      throw new Error("provider must not be called");
    },
  });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "PAYPAL_PRODUCTION_NOT_AUTHORIZED");
  assert.equal(fetched, false);
  assert.equal(batches.length, 0);
});

test("live PayPal order creation rejects autonomous capital above zero", async () => {
  const { db, batches } = livePaymentOrderFixture();
  let fetched = false;
  const response = await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders", {
    quote_id:QUOTE_ID,
  }), {
    ADMIN_API_TOKEN:"admin-secret-token",
    DB:db,
    PAYPAL_ORDER_CREATION_ENABLED:"true",
    PAYPAL_LIVE_ORDER_CREATION_ENABLED:"true",
    PAYPAL_ENVIRONMENT:"live",
    PAYPAL_CLIENT_ID:"live-client",
    PAYPAL_CLIENT_SECRET:"live-secret",
    PRODUCTION_AUTHORIZED:"true",
    MAX_AUTONOMOUS_CAPITAL_USD:"1",
  }, {
    fetchImpl: async () => {
      fetched = true;
      throw new Error("provider must not be called");
    },
  });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "PAYPAL_AUTONOMOUS_CAPITAL_NOT_ALLOWED");
  assert.equal(fetched, false);
  assert.equal(batches.length, 0);
});

test("fully gated live PayPal order creation uses live API without capture", async () => {
  const { db, batches, updates } = livePaymentOrderFixture();
  const seen = [];
  const response = await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders", {
    quote_id:QUOTE_ID,
  }), {
    ADMIN_API_TOKEN:"admin-secret-token",
    DB:db,
    PAYPAL_ORDER_CREATION_ENABLED:"true",
    PAYPAL_LIVE_ORDER_CREATION_ENABLED:"true",
    PAYPAL_ENVIRONMENT:"live",
    PAYPAL_CLIENT_ID:"live-client",
    PAYPAL_CLIENT_SECRET:"live-secret",
    PRODUCTION_AUTHORIZED:"true",
    MAX_AUTONOMOUS_CAPITAL_USD:"0",
  }, {
    fetchImpl: async (url, options = {}) => {
      seen.push({ url:String(url), options });
      if (String(url).endsWith("/v1/oauth2/token")) {
        return Response.json({ access_token:"live-token" });
      }
      if (String(url).endsWith("/v2/checkout/orders")) {
        const requestBody = JSON.parse(options.body);
        assert.equal(requestBody.intent, "CAPTURE");
        assert.equal(requestBody.purchase_units[0].amount.value, "250.00");
        assert.equal(requestBody.purchase_units[0].amount.currency_code, "USD");
        assert.equal(requestBody.purchase_units[0].invoice_id, QUOTE_ID);
        return Response.json({
          id:"LIVE-PAYPAL-ORDER-123",
          status:"PAYER_ACTION_REQUIRED",
          links:[{
            rel:"payer-action",
            href:"https://www.paypal.com/checkoutnow?token=LIVE-PAYPAL-ORDER-123",
          }],
        }, { status:201 });
      }
      throw new Error("unexpected provider URL");
    },
  });

  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.provider_order_id, "LIVE-PAYPAL-ORDER-123");
  assert.equal(body.provider_environment, "live");
  assert.equal(body.provider_call_performed, true);
  assert.equal(body.capture_performed, false);
  assert.equal(body.financial_execution_authorized, false);
  assert.equal(seen.length, 2);
  assert.equal(seen.every((entry) => entry.url.startsWith("https://api-m.paypal.com/")), true);
  assert.equal(seen.some((entry) => /\/capture(?:$|[/?])/.test(entry.url)), false);
  assert.equal(batches.length, 1);
  assert.equal(updates.length, 1);
});
