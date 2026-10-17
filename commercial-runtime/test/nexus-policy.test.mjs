import test from "node:test";
import assert from "node:assert/strict";
import { evaluateNexusPolicy, persistNexusPolicyDecision } from "../src/nexus-policy.mjs";

const project = {
  project_id: "82555092-cd10-4487-a637-ea2b1915aeb2",
  service_ids_json: '["architecture","support"]',
};
const response = (json, status = 200) =>
  new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });

test("missing Nexus binding fails closed without an outbound request", async () => {
  assert.deepEqual(await evaluateNexusPolicy({}, project), {
    decision: "REQUIRES_HUMAN",
    reason: "NEXUS_POLICY_BINDING_MISSING",
    evidence_id: null,
    fail_closed: true,
  });
});

test("Nexus policy uses only the private service binding and minimal project data", async () => {
  const calls = [];
  const result = await evaluateNexusPolicy({
    NEXUS_POLICY: { async fetch(request) {
      calls.push({ url: request.url, method: request.method, body: await request.json() });
      return response({ decision: "ALLOW", reason: "certified", evidence_id: "nexus-evidence-123" });
    } },
  }, project);
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.evidence_id, "nexus-evidence-123");
  assert.equal(result.fail_closed, false);
  assert.deepEqual(calls, [{
    url: "https://nexus.internal/v1/project-readiness",
    method: "POST",
    body: {
      project_id: project.project_id,
      service_ids: ["architecture", "support"],
      requested_transition: "POLICY_ALLOWED",
    },
  }]);
});

test("all incomplete/error policy results require human review", async () => {
  const cases = [
    [{ decision: "ALLOW" }, 200, "NEXUS_ALLOW_EVIDENCE_MISSING"],
    [{ decision: "ALLOW", evidence_id: "<script>" }, 200, "NEXUS_ALLOW_EVIDENCE_MISSING"],
    [{ decision: "UNKNOWN" }, 200, "INVALID_NEXUS_DECISION"],
    [{ error: "upstream" }, 502, "NEXUS_HTTP_502"],
  ];
  for (const [body, status, reason] of cases) {
    const result = await evaluateNexusPolicy({ NEXUS_POLICY: {
      fetch: async () => response(body, status),
    } }, project);
    assert.deepEqual([result.decision, result.reason, result.fail_closed],
      ["REQUIRES_HUMAN", reason, true]);
  }
  const network = await evaluateNexusPolicy({ NEXUS_POLICY: {
    fetch: async () => { throw Error("confidential upstream error"); },
  } }, project);
  assert.equal(network.reason, "NEXUS_POLICY_FETCH_FAILED");
  assert.equal(network.decision, "REQUIRES_HUMAN");
  const badJson = await evaluateNexusPolicy({ NEXUS_POLICY: {
    fetch: async () => new Response("not json", { status: 200 }),
  } }, project);
  assert.equal(badJson.reason, "INVALID_NEXUS_RESPONSE");
  const big = await evaluateNexusPolicy({ NEXUS_POLICY: {
    fetch: async () => new Response("x".repeat(8200), { status: 200 }),
  } }, project);
  assert.equal(big.reason, "NEXUS_RESPONSE_TOO_LARGE");
});

test("Nexus may explicitly deny or request review but never directly perform actions", async () => {
  for (const decision of ["DENY", "REQUIRES_HUMAN"]) {
    const result = await evaluateNexusPolicy({ NEXUS_POLICY: {
      fetch: async () => response({ decision, reason: "requires owner", evidence_id: "ev-1" }),
    } }, project);
    assert.equal(result.decision, decision);
    assert.equal(result.fail_closed, true);
    assert.equal(result.evidence_id, "ev-1");
  }
});

test("policy decision is written to immutable evidence with a stable id and guarded state", async () => {
  const seen = [];
  const db = {
    prepare(sql) {
      return { bind(...values) { seen.push({ sql, values }); return { sql, values }; } };
    },
    async batch(statements) { assert.equal(statements.length, 2); },
  };
  await persistNexusPolicyDecision({ DB: db }, project.project_id, {
    decision: "REQUIRES_HUMAN",
    reason: "NEXUS_POLICY_BINDING_MISSING",
    evidence_id: null,
    fail_closed: true,
  }, "POLICY_CHECK", "REQUIRES_HUMAN");
  assert.match(seen[0].sql, /^INSERT OR IGNORE INTO evidence_events/);
  assert.equal(seen[0].values[0], "nexus-policy:" + project.project_id);
  assert.equal(seen[0].values[2], "NEXUS_POLICY_EVALUATED");
  assert.deepEqual(JSON.parse(seen[0].values[5]), {
    decision: "REQUIRES_HUMAN",
    reason: "NEXUS_POLICY_BINDING_MISSING",
    evidence_id: null,
    fail_closed: true,
    contract_version: "nexus-policy-v1",
  });
  assert.match(seen[1].sql, /state IN \('VALIDATED','POLICY_CHECK'\)/);
  assert.equal(seen[1].values[0], "POLICY_CHECK");
  assert.equal(seen[1].values[1], "REQUIRES_HUMAN");
});

test("policy database failures reject; they cannot silently allow promotion", async () => {
  const db = {
    prepare: () => ({ bind: () => ({}) }),
    batch: async () => { throw Error("write blocked"); },
  };
  await assert.rejects(persistNexusPolicyDecision({ DB: db }, project.project_id,
    { decision: "ALLOW", reason: "ok", evidence_id: "nexus-1", fail_closed: false },
    "POLICY_ALLOWED", "ALLOWED"), /write blocked/);
});

test("deployment configuration must gate a private certified Nexus service", async () => {
  const { readFileSync } = await import("node:fs");
  const deploy = readFileSync(new URL("../../.github/workflows/deploy-commercial-runtime.yml", import.meta.url), "utf8");
  assert.match(deploy, /NEXUS_POLICY_SERVICE_RAW:.*vars\.NEXUS_POLICY_SERVICE/);
  assert.match(deploy, /NEXUS_SERVICE_PREFLIGHT=FAIL_HTTP_/);
  assert.match(deploy, /--arg nexus "\$NEXUS_POLICY_SERVICE"/);
  assert.match(deploy, /services:\[\{binding:"NEXUS_POLICY",service:\$nexus\}\]/);
  assert.match(deploy, /NEXUS_POLICY_BINDING_CONFIG=PASS/);
  assert.match(deploy, /workflow_dispatch:/);
  assert.doesNotMatch(deploy, /^\s+push:\s*$/m);
});
