import test from "node:test";
import assert from "node:assert/strict";
import { handlePayPalWebhook } from "../src/worker.mjs";

const headers = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api-m.paypal.com/certs/test.pem",
  "paypal-transmission-id": "abc-123",
  "paypal-transmission-sig": "signature",
  "paypal-transmission-time": "2026-09-01T00:00:00Z",
};

function eventBody(id = "WH-123") {
  return JSON.stringify({
    id,
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: "CAPTURE-123",
      status: "COMPLETED",
      amount: { value: "250.00", currency_code: "USD" }
    }
  });
}

function paypalEnv(db) {
  return {
    PAYPAL_CLIENT_ID: "client",
    PAYPAL_CLIENT_SECRET: "secret",
    PAYPAL_WEBHOOK_ID: "WH-ID",
    DB: db,
  };
}

test("PayPal webhook fails closed when provider credentials are missing", async () => {
  const response = await handlePayPalWebhook(new Request("https://intake.jadeltechrd.com/api/v1/paypal/webhooks", {
    method: "POST",
    body: eventBody(),
  }), { DB: {} });
  assert.equal(response.status, 503);
});

test("PayPal webhook rejects failed signature verification before writes", async () => {
  let wrote = false;
  const db = { batch: async () => { wrote = true; } };
  const response = await handlePayPalWebhook(new Request("https://intake.jadeltechrd.com/api/v1/paypal/webhooks", {
    method: "POST",
    headers,
    body: eventBody(),
  }), paypalEnv(db), {
    fetchImpl: async (url) => {
      if (String(url).endsWith("/v1/oauth2/token")) return Response.json({ access_token: "token" });
      return Response.json({ verification_status: "FAILURE" });
    }
  });
  assert.equal(response.status, 403);
  assert.equal(wrote, false);
});

test("verified PayPal webhook stores event and ledger as human-reconciled", async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          statements.push({ sql, values });
          return { first: async () => null };
        }
      };
    },
    batch: async (items) => {
      assert.equal(items.length, 2);
    }
  };
  const response = await handlePayPalWebhook(new Request("https://intake.jadeltechrd.com/api/v1/paypal/webhooks", {
    method: "POST",
    headers,
    body: eventBody("WH-456"),
  }), paypalEnv(db), {
    fetchImpl: async (url) => {
      if (String(url).endsWith("/v1/oauth2/token")) return Response.json({ access_token: "token" });
      return Response.json({ verification_status: "SUCCESS" });
    }
  });
  const body = await response.json();
  assert.equal(response.status, 202);
  assert.equal(body.provider_event_id, "WH-456");
  assert.equal(body.ledger_state, "REQUIRES_HUMAN");
  assert.equal(statements.some((entry) => entry.values.includes("REQUIRES_HUMAN")), true);
});
