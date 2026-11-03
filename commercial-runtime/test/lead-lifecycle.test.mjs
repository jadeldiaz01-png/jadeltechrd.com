import test from "node:test";
import assert from "node:assert/strict";
import worker, { handleAdminLeadLifecycle } from "../src/worker.mjs";

const PROJECT_ID = "123e4567-e89b-12d3-a456-426614174000";
const SOURCE_EVENT_ID = "223e4567-e89b-12d3-a456-426614174000";
const URL = "https://intake.jadeltechrd.com/api/v1/admin/lead-lifecycle";

function envWithDb(db = {}, extra = {}) {
  return { ADMIN_API_TOKEN: "admin-secret-token", DB: db, ...extra };
}

function post(stage = "qualify_lead", sourceEventId = SOURCE_EVENT_ID, projectId = PROJECT_ID) {
  return new Request(URL, {
    method: "POST",
    headers: {
      authorization: "Bearer admin-secret-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ project_id: projectId, stage, source_event_id: sourceEventId }),
  });
}

test("admin lead lifecycle records only an allowed-project human qualification event", async () => {
  const inserts = [];
  const db = {
    prepare(sql) {
      return { bind(...values) {
        if (sql.includes("FROM lead_lifecycle_events")) return { first: async () => null };
        if (sql.includes("FROM project_requests")) return { first: async () => ({
          project_id: PROJECT_ID, state: "POLICY_ALLOWED", policy_status: "ALLOWED",
        }) };
        if (sql.includes("INSERT INTO lead_lifecycle_events")) return { run: async () => {
          inserts.push({ sql, values });
          return { success: true };
        } };
        throw new Error(`unexpected SQL: ${sql}`);
      } };
    },
  };

  const response = await handleAdminLeadLifecycle(post(), envWithDb(db));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.project_id, PROJECT_ID);
  assert.equal(body.stage, "qualify_lead");
  assert.equal(body.source_event_id, SOURCE_EVENT_ID);
  assert.equal(body.replayed, false);
  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0].values.slice(1, 6), [
    PROJECT_ID,
    "qualify_lead",
    "human",
    SOURCE_EVENT_ID,
    JSON.stringify({ source: "approval_console", actor: "admin" }),
  ]);
});

test("admin lead lifecycle idempotently replays the same event", async () => {
  let insertTouched = false;
  const db = {
    prepare(sql) {
      return { bind() {
        if (sql.includes("FROM lead_lifecycle_events")) return { first: async () => ({
          event_id: "event-existing", project_id: PROJECT_ID, stage: "qualify_lead", created_at: "2026-11-03T00:00:00.000Z",
        }) };
        if (sql.includes("INSERT INTO lead_lifecycle_events")) {
          insertTouched = true;
          throw new Error("replay must not insert");
        }
        throw new Error(`unexpected SQL: ${sql}`);
      } };
    },
  };
  const response = await handleAdminLeadLifecycle(post(), envWithDb(db));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.event_id, "event-existing");
  assert.equal(body.replayed, true);
  assert.equal(insertTouched, false);
});

test("admin lead lifecycle rejects idempotency-key reuse for a different stage", async () => {
  const db = {
    prepare(sql) {
      return { bind() {
        if (sql.includes("FROM lead_lifecycle_events")) return { first: async () => ({
          event_id: "event-existing", project_id: PROJECT_ID, stage: "working_lead", created_at: "2026-11-03T00:00:00.000Z",
        }) };
        throw new Error("conflicting replay must not query or write anything else");
      } };
    },
  };
  const response = await handleAdminLeadLifecycle(post("qualify_lead"), envWithDb(db));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "IDEMPOTENCY_KEY_REUSED");
});

test("admin lead lifecycle does not create duplicate rows when the requested stage is already current", async () => {
  let insertTouched = false;
  const db = {
    prepare(sql) {
      return { bind() {
        if (sql.includes("FROM lead_lifecycle_events") && sql.includes("source_event_id")) return { first: async () => null };
        if (sql.includes("FROM project_requests")) return { first: async () => ({
          project_id: PROJECT_ID, state: "POLICY_ALLOWED", policy_status: "ALLOWED",
        }) };
        if (sql.includes("FROM lead_lifecycle_events")) return { first: async () => ({
          event_id: "event-current", stage: "qualify_lead", created_at: "2026-11-03T00:00:00.000Z",
        }) };
        if (sql.includes("INSERT INTO lead_lifecycle_events")) {
          insertTouched = true;
          throw new Error("unchanged stage must not insert");
        }
        throw new Error(`unexpected SQL: ${sql}`);
      } };
    },
  };
  const response = await handleAdminLeadLifecycle(post(), envWithDb(db));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.unchanged, true);
  assert.equal(body.event_id, "event-current");
  assert.equal(insertTouched, false);
});

test("admin lead lifecycle rejects anonymous or unconfigured access and non-POST methods", async () => {
  const request = post();
  const anonymous = new Request(URL, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const noToken = await handleAdminLeadLifecycle(request, { DB: {} });
  const unauthorized = await handleAdminLeadLifecycle(anonymous, envWithDb());
  const method = await handleAdminLeadLifecycle(new Request(URL, {
    headers: { authorization: "Bearer admin-secret-token" },
  }), envWithDb());
  assert.equal(noToken.status, 503);
  assert.equal(unauthorized.status, 401);
  assert.equal(method.status, 405);
});

test("admin lead lifecycle route preserves exact-origin CORS and rejects foreign origins", async () => {
  const env = envWithDb({}, { PUBLIC_ORIGIN: "https://jadeltechrd.com" });
  const preflight = await worker.fetch(new Request(URL, {
    method: "OPTIONS",
    headers: { origin: "https://jadeltechrd.com" },
  }), env);
  const foreignPreflight = await worker.fetch(new Request(URL, {
    method: "OPTIONS",
    headers: { origin: "https://attacker.example" },
  }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://jadeltechrd.com");
  assert.equal(foreignPreflight.status, 403);
  assert.equal(foreignPreflight.headers.get("access-control-allow-origin"), null);
});

test("admin lead lifecycle rejects invalid stage, identifiers, and non-quotable projects before writing", async () => {
  let dbTouched = false;
  const db = { prepare() { dbTouched = true; throw new Error("invalid request must not query"); } };
  const invalidStage = await handleAdminLeadLifecycle(post("close_convert_lead"), envWithDb(db));
  const invalidProject = await handleAdminLeadLifecycle(post("qualify_lead", SOURCE_EVENT_ID, "not-a-uuid"), envWithDb(db));
  assert.equal(invalidStage.status, 400);
  assert.equal(invalidProject.status, 400);
  assert.equal(dbTouched, false);

  const notQuotableDb = {
    prepare(sql) {
      return { bind() {
        if (sql.includes("FROM lead_lifecycle_events")) return { first: async () => null };
        if (sql.includes("FROM project_requests")) return { first: async () => ({
          project_id: PROJECT_ID, state: "POLICY_CHECK", policy_status: "REQUIRES_HUMAN",
        }) };
        throw new Error("not-quotable project must not write");
      } };
    },
  };
  const notQuotable = await handleAdminLeadLifecycle(post(), envWithDb(notQuotableDb));
  assert.equal(notQuotable.status, 409);
  assert.equal((await notQuotable.json()).error, "PROJECT_NOT_COMMERCIALLY_READY");
});

test("admin lead lifecycle reports unknown projects without an insert", async () => {
  let insertTouched = false;
  const db = {
    prepare(sql) {
      return { bind() {
        if (sql.includes("FROM lead_lifecycle_events")) return { first: async () => null };
        if (sql.includes("FROM project_requests")) return { first: async () => null };
        if (sql.includes("INSERT INTO lead_lifecycle_events")) insertTouched = true;
        return { run: async () => ({ success: true }) };
      } };
    },
  };
  const response = await handleAdminLeadLifecycle(post(), envWithDb(db));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "PROJECT_NOT_FOUND");
  assert.equal(insertTouched, false);
});
