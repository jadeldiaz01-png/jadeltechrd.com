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
