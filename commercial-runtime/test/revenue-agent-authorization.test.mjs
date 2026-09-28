import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRevenueRuntimeAuthorization,
  canonicalRevenueAuthorization,
  hmacSha256Hex,
} from "../src/revenue-agent-authorization.mjs";

const SECRET = "0123456789abcdef0123456789abcdef";

function dbFixture({ allowed=true, approved=true, matched=true } = {}) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("FROM project_requests")) {
                return allowed ? { project_id:args[0], policy_status:"ALLOWED" } : null;
              }
              if (sql.includes("FROM approval_events")) {
                return approved ? { approval_id:"approval-001" } : null;
              }
              if (sql.includes("FROM payment_ledger")) {
                return matched ? { ledger_id:args[0] } : null;
              }
              throw new Error("unexpected query");
            }
          };
        }
      };
    }
  };
}

const input = {
  project_id:"11111111-1111-1111-1111-111111111111",
  ledger_id:"ledger-001",
  action:"prepare_deliverable",
  request_id:"request-001",
};

test("authorization is short-lived, signed and denies privilege expansion", async () => {
  const envelope = await buildRevenueRuntimeAuthorization(dbFixture(), input, SECRET, 1000);
  assert.equal(envelope.issued_at, 1000);
  assert.equal(envelope.expires_at, 1300);
  assert.match(envelope.authorization_signature, /^[0-9a-f]{64}$/);
  assert.equal(envelope.financial_action, false);
  assert.equal(envelope.publication, false);
  assert.equal(envelope.contract_acceptance, false);
  assert.equal(envelope.production_deploy, false);
  assert.equal(
    envelope.authorization_signature,
    await hmacSha256Hex(SECRET, canonicalRevenueAuthorization(envelope)),
  );
});

test("authorization requires allowed policy", async () => {
  await assert.rejects(
    buildRevenueRuntimeAuthorization(dbFixture({ allowed:false }), input, SECRET, 1000),
    /PROJECT_POLICY_NOT_ALLOWED/,
  );
});

test("authorization requires approved policy evidence", async () => {
  await assert.rejects(
    buildRevenueRuntimeAuthorization(dbFixture({ approved:false }), input, SECRET, 1000),
    /APPROVAL_EVIDENCE_MISSING/,
  );
});

test("authorization requires matched payment or escrow", async () => {
  await assert.rejects(
    buildRevenueRuntimeAuthorization(dbFixture({ matched:false }), input, SECRET, 1000),
    /MATCHED_PAYMENT_OR_ESCROW_REQUIRED/,
  );
});

test("weak signing secret fails closed", async () => {
  await assert.rejects(
    buildRevenueRuntimeAuthorization(dbFixture(), input, "short", 1000),
    /REVENUE_RUNTIME_HMAC_KEY_NOT_CONFIGURED/,
  );
});
