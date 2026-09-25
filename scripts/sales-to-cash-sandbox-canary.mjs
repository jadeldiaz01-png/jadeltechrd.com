import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  handleAdminQuoteCreate,
  handleAdminQuoteAcceptance,
  handleAdminPaymentOrderCreate,
  handleAdminPaymentReconciliation,
} from "../commercial-runtime/src/worker.mjs";

const ADMIN_TOKEN = "sandbox-admin-token-without-production-authority";
const migrationsDir = path.resolve("commercial-runtime/migrations");
const evidenceDir = path.resolve("evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

function createD1() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jadel-sales-canary-"));
  const sqlite = new DatabaseSync(path.join(dir, "canary.sqlite"));
  const migrationFiles = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  for (const file of migrationFiles) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
  }

  class BoundStatement {
    constructor(sql, params) {
      this.sql = sql;
      this.params = params;
    }
    first() {
      return sqlite.prepare(this.sql).get(...this.params) ?? null;
    }
    all() {
      return { results: sqlite.prepare(this.sql).all(...this.params) };
    }
    run() {
      return sqlite.prepare(this.sql).run(...this.params);
    }
  }

  const adapter = {
    prepare(sql) {
      return {
        bind(...params) {
          return new BoundStatement(sql, params);
        },
        first() {
          return sqlite.prepare(sql).get() ?? null;
        },
        all() {
          return { results: sqlite.prepare(sql).all() };
        },
        run() {
          return sqlite.prepare(sql).run();
        },
      };
    },
    batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map((statement) => statement.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        try { sqlite.exec("ROLLBACK"); } catch {}
        throw error;
      }
    },
  };

  return { sqlite, adapter, dir };
}

function env(db) {
  return { ADMIN_API_TOKEN: ADMIN_TOKEN, DB: db };
}

function request(pathname, body) {
  return new Request(`https://intake.invalid${pathname}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ADMIN_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function seedAllowedProject(sqlite, projectId) {
  const now = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO project_requests
    (project_id,idempotency_key,request_fingerprint,name,email,company,service_ids_json,notes,locale,state,policy_status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    projectId,
    `canary-${projectId}`,
    crypto.createHash("sha256").update(projectId).digest("hex"),
    "Sandbox Canary",
    "sandbox-canary@example.invalid",
    "Jadel Tech RD Canary",
    JSON.stringify(["architecture"]),
    "",
    "es-DO",
    "POLICY_ALLOWED",
    "ALLOWED",
    now,
    now,
  );
}

async function createQuote(db, projectId, { amountMinor = 25000, expiresAt = null } = {}) {
  const response = await handleAdminQuoteCreate(request("/api/v1/admin/quotes", {
    project_id: projectId,
    currency_code: "USD",
    expires_at: expiresAt,
    items: [{
      service_id: "architecture",
      description: "Sandbox Agentic Blueprint",
      quantity: 1,
      unit_amount_minor: amountMinor,
    }],
  }), env(db));
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  return body;
}

async function acceptQuote(db, quoteId, evidence = "sandbox customer acceptance evidence") {
  const response = await handleAdminQuoteAcceptance(request("/api/v1/admin/quotes/accept", {
    quote_id: quoteId,
    acceptance_evidence: evidence,
  }), env(db));
  return { response, body: await response.json() };
}

async function createPaymentOrder(db, quoteId) {
  const response = await handleAdminPaymentOrderCreate(request("/api/v1/admin/payment-orders", {
    quote_id: quoteId,
  }), env(db));
  return { response, body: await response.json() };
}

function seedVerifiedProviderEvent(sqlite, {
  projectId = null,
  ledgerState,
  eventType,
  amount = "250.00",
  currency = "USD",
}) {
  const eventId = `WH-CANARY-${crypto.randomUUID()}`;
  const ledgerId = crypto.randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO payment_events
    (provider_event_id,provider,event_type,resource_id,resource_status,gross_amount,currency_code,raw_event_json,verification_status,received_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    eventId,
    "paypal",
    eventType,
    `CAPTURE-${crypto.randomUUID()}`,
    eventType.includes("COMPLETED") ? "COMPLETED" : "PENDING",
    amount,
    currency,
    JSON.stringify({ canary: true, simulated: true, verified_fixture: true }),
    "VERIFIED",
    now,
  );
  sqlite.prepare(`
    INSERT INTO payment_ledger
    (ledger_id,provider_event_id,project_id,provider,ledger_state,amount_usd,currency_code,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    ledgerId,
    eventId,
    projectId,
    "paypal",
    ledgerState,
    amount,
    currency,
    "sandbox verified-provider fixture; no provider network call or money movement",
    now,
    now,
  );
  return { eventId, ledgerId };
}

async function happyPath() {
  const { sqlite, adapter } = createD1();
  const projectId = crypto.randomUUID();
  seedAllowedProject(sqlite, projectId);

  const quote = await createQuote(adapter, projectId);
  const accepted = await acceptQuote(adapter, quote.quote_id);
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.body.project_state, "CUSTOMER_APPROVED");

  const order = await createPaymentOrder(adapter, quote.quote_id);
  assert.equal(order.response.status, 201);
  assert.equal(order.body.status, "PENDING");
  assert.equal(order.body.provider_call_performed, false);

  const payment = seedVerifiedProviderEvent(sqlite, {
    ledgerState: "REQUIRES_HUMAN",
    eventType: "PAYMENT.CAPTURE.COMPLETED",
  });

  const settledResponse = await handleAdminPaymentReconciliation(request("/api/v1/admin/payments/reconcile", {
    project_id: projectId,
    ledger_id: payment.ledgerId,
    payment_order_id: order.body.payment_order_id,
    decision: "MATCHED",
    reason: "sandbox completed provider event matched to accepted quote",
  }), env(adapter));
  const settled = await settledResponse.json();
  assert.equal(settledResponse.status, 200, JSON.stringify(settled));
  assert.equal(settled.project_state, "PAID");
  assert.equal(settled.ledger_state, "MATCHED");

  const project = sqlite.prepare("SELECT state FROM project_requests WHERE project_id=?").get(projectId);
  const ledger = sqlite.prepare("SELECT ledger_state FROM payment_ledger WHERE ledger_id=?").get(payment.ledgerId);
  const paymentOrder = sqlite.prepare("SELECT status FROM payment_orders WHERE payment_order_id=?").get(order.body.payment_order_id);
  const settlement = sqlite.prepare("SELECT COUNT(*) AS count FROM sales_settlements WHERE ledger_id=?").get(payment.ledgerId);
  assert.equal(project.state, "PAID");
  assert.equal(ledger.ledger_state, "MATCHED");
  assert.equal(paymentOrder.status, "COMPLETED");
  assert.equal(Number(settlement.count), 1);

  return { status: "PASS", terminal_state: "PAID", settlement_count: Number(settlement.count) };
}

async function pendingFailsClosed() {
  const { sqlite, adapter } = createD1();
  const projectId = crypto.randomUUID();
  seedAllowedProject(sqlite, projectId);
  const quote = await createQuote(adapter, projectId);
  assert.equal((await acceptQuote(adapter, quote.quote_id)).response.status, 200);
  const order = await createPaymentOrder(adapter, quote.quote_id);
  assert.equal(order.response.status, 201);
  const payment = seedVerifiedProviderEvent(sqlite, {
    ledgerState: "RECONCILING",
    eventType: "PAYMENT.CAPTURE.PENDING",
  });

  const response = await handleAdminPaymentReconciliation(request("/api/v1/admin/payments/reconcile", {
    project_id: projectId,
    ledger_id: payment.ledgerId,
    payment_order_id: order.body.payment_order_id,
    decision: "MATCHED",
  }), env(adapter));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "PAYMENT_LEDGER_NOT_SETTLEABLE");
  assert.equal(sqlite.prepare("SELECT state FROM project_requests WHERE project_id=?").get(projectId).state, "PAYMENT_PENDING");
  assert.equal(sqlite.prepare("SELECT ledger_state FROM payment_ledger WHERE ledger_id=?").get(payment.ledgerId).ledger_state, "RECONCILING");
  assert.equal(Number(sqlite.prepare("SELECT COUNT(*) AS count FROM sales_settlements").get().count), 0);
  return { status: "PASS", rejected_with: body.error };
}

async function mismatchFailsClosed(kind) {
  const { sqlite, adapter } = createD1();
  const projectId = crypto.randomUUID();
  seedAllowedProject(sqlite, projectId);
  const quote = await createQuote(adapter, projectId);
  assert.equal((await acceptQuote(adapter, quote.quote_id)).response.status, 200);
  const order = await createPaymentOrder(adapter, quote.quote_id);
  assert.equal(order.response.status, 201);
  const payment = seedVerifiedProviderEvent(sqlite, {
    ledgerState: "REQUIRES_HUMAN",
    eventType: "PAYMENT.CAPTURE.COMPLETED",
    amount: kind === "amount" ? "249.99" : "250.00",
    currency: kind === "currency" ? "EUR" : "USD",
  });

  const response = await handleAdminPaymentReconciliation(request("/api/v1/admin/payments/reconcile", {
    project_id: projectId,
    ledger_id: payment.ledgerId,
    payment_order_id: order.body.payment_order_id,
    decision: "MATCHED",
  }), env(adapter));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "PAYMENT_ORDER_AMOUNT_OR_CURRENCY_MISMATCH");
  assert.equal(sqlite.prepare("SELECT state FROM project_requests WHERE project_id=?").get(projectId).state, "PAYMENT_PENDING");
  assert.equal(Number(sqlite.prepare("SELECT COUNT(*) AS count FROM sales_settlements").get().count), 0);
  return { status: "PASS", rejected_with: body.error };
}

async function expiredQuoteFailsClosed() {
  const { sqlite, adapter } = createD1();
  const projectId = crypto.randomUUID();
  seedAllowedProject(sqlite, projectId);
  const quote = await createQuote(adapter, projectId, { expiresAt: "2020-01-01T00:00:00.000Z" });
  const accepted = await acceptQuote(adapter, quote.quote_id, "late sandbox acceptance");
  assert.equal(accepted.response.status, 409);
  assert.equal(accepted.body.error, "QUOTE_EXPIRED");
  assert.equal(sqlite.prepare("SELECT status FROM quotes WHERE quote_id=?").get(quote.quote_id).status, "EXPIRED");
  assert.equal(Number(sqlite.prepare("SELECT COUNT(*) AS count FROM approval_events WHERE approval_type='quote_acceptance'").get().count), 0);
  return { status: "PASS", rejected_with: accepted.body.error };
}

async function duplicatePaymentOrderFailsClosed() {
  const { sqlite, adapter } = createD1();
  const projectId = crypto.randomUUID();
  seedAllowedProject(sqlite, projectId);
  const quote = await createQuote(adapter, projectId);
  assert.equal((await acceptQuote(adapter, quote.quote_id)).response.status, 200);
  const first = await createPaymentOrder(adapter, quote.quote_id);
  assert.equal(first.response.status, 201);

  const second = await createPaymentOrder(adapter, quote.quote_id);
  assert.equal(second.response.status, 409);
  assert.equal(second.body.error, "QUOTE_NOT_READY_FOR_PAYMENT");

  const firstRow = sqlite.prepare(
    "SELECT project_id,provider,amount_minor,currency_code FROM payment_orders WHERE payment_order_id=?"
  ).get(first.body.payment_order_id);
  let uniquenessRejected = false;
  try {
    const now = new Date().toISOString();
    sqlite.prepare(
      "INSERT INTO payment_orders (payment_order_id,quote_id,project_id,provider,provider_order_id,status,amount_minor,currency_code,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).run(
      crypto.randomUUID(),
      quote.quote_id,
      firstRow.project_id,
      firstRow.provider,
      "",
      "PENDING",
      firstRow.amount_minor,
      firstRow.currency_code,
      now,
      now,
    );
  } catch (error) {
    uniquenessRejected = String(error?.message || error).includes("UNIQUE");
  }
  assert.equal(uniquenessRejected, true);
  assert.equal(Number(sqlite.prepare("SELECT COUNT(*) AS count FROM payment_orders WHERE quote_id=?").get(quote.quote_id).count), 1);
  return {
    status: "PASS",
    api_rejected_with: second.body.error,
    db_unique_quote_invariant: true,
    row_count: 1,
  };
}

const scenarios = {
  happy_path: await happyPath(),
  pending_reconciling_fail_closed: await pendingFailsClosed(),
  amount_mismatch_fail_closed: await mismatchFailsClosed("amount"),
  currency_mismatch_fail_closed: await mismatchFailsClosed("currency"),
  expired_quote_fail_closed: await expiredQuoteFailsClosed(),
  duplicate_payment_order_fail_closed: await duplicatePaymentOrderFailsClosed(),
};

for (const result of Object.values(scenarios)) assert.equal(result.status, "PASS");

const evidence = {
  schema: "jadel.sales-to-cash.sandbox-canary.v1",
  status: "PASS",
  observed_at: new Date().toISOString(),
  subject_sha: process.env.GITHUB_SHA || "LOCAL",
  workflow_run_id: process.env.GITHUB_RUN_ID || null,
  environment: "EPHEMERAL_LOCAL_SQLITE_D1_COMPAT",
  authority: {
    production_mutation: false,
    provider_network_calls: false,
    paypal_credentials_used: false,
    money_movement: false,
    autonomous_financial_authority: false,
  },
  exercised_path: [
    "POLICY_ALLOWED",
    "QUOTED",
    "CUSTOMER_APPROVED",
    "PAYMENT_PENDING",
    "VERIFIED_COMPLETED_FIXTURE",
    "MATCHED",
    "PAID",
  ],
  scenarios,
};

fs.writeFileSync(
  path.join(evidenceDir, "sales-to-cash-sandbox-canary.json"),
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log("SALES_TO_CASH_SANDBOX_CANARY=PASS");
for (const [name, result] of Object.entries(scenarios)) {
  console.log(`SCENARIO_${name.toUpperCase()}=${result.status}`);
}
