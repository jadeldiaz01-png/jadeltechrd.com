import { validateIdempotencyKey, validateProjectRequest } from "./validation.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const TURNSTILE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const INSERT_REQUEST_SQL = `INSERT INTO project_requests
(project_id,idempotency_key,name,email,company,service_ids_json,notes,locale,state,policy_status,created_at,updated_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
const INSERT_EVIDENCE_SQL = `INSERT INTO evidence_events
(event_id,project_id,event_type,state,correlation_id,payload_json,created_at)
VALUES (?,?,?,?,?,?,?)`;
const INSERT_OUTBOX_SQL = `INSERT INTO dispatch_outbox
(outbox_id,project_id,workflow_instance_id,status,attempts,created_at,updated_at)
VALUES (?,?,?,?,?,?,?)`;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function originAllowed(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === env.PUBLIC_ORIGIN;
}

async function stableRateKey(request) {
  const raw = `${request.headers.get("cf-connecting-ip") || "unknown"}|${request.headers.get("user-agent") || "unknown"}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile(token, env, remoteIp, fetchImpl = fetch) {
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);
  const response = await fetchImpl(TURNSTILE_SITEVERIFY, { method: "POST", body: form });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

async function readJsonWithLimit(request) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (declared > MAX_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");
  try { return JSON.parse(text); } catch { throw new Error("INVALID_JSON"); }
}

export async function handleProjectRequest(request, env, deps = {}) {
  if (!originAllowed(request, env)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (!env.DB || !env.PROJECT_REQUEST_RATE_LIMITER || !env.TURNSTILE_SECRET_KEY) {
    return json({ error: "RUNTIME_NOT_CONFIGURED" }, 503);
  }

  const rateKey = await stableRateKey(request);
  const limit = await env.PROJECT_REQUEST_RATE_LIMITER.limit({ key: `project:${rateKey}` });
  if (!limit.success) return json({ error: "RATE_LIMITED" }, 429, { "retry-after": "60" });

  let idempotencyKey;
  let input;
  try {
    idempotencyKey = validateIdempotencyKey(request.headers.get("idempotency-key"));
    input = validateProjectRequest(await readJsonWithLimit(request));
  } catch (error) {
    const code = String(error?.message || "INVALID_REQUEST");
    return json({ error: code }, code === "REQUEST_TOO_LARGE" ? 413 : 400);
  }

  const turnstileOk = await verifyTurnstile(
    input.turnstileToken,
    env,
    request.headers.get("cf-connecting-ip"),
    deps.fetchImpl,
  );
  if (!turnstileOk) return json({ error: "TURNSTILE_FAILED" }, 403);

  const existing = await env.DB.prepare(
    "SELECT project_id,state,policy_status FROM project_requests WHERE idempotency_key = ? LIMIT 1"
  ).bind(idempotencyKey).first();
  if (existing) return json({ ...existing, replayed: true }, 200);

  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();
  const workflowInstanceId = `project-${projectId}`;
  const state = "VALIDATED";
  const policyStatus = "PENDING";

  try {
    await env.DB.batch([
      env.DB.prepare(INSERT_REQUEST_SQL).bind(
        projectId,idempotencyKey,input.name,input.email,input.company,
        JSON.stringify(input.serviceIds),input.notes,input.locale,state,policyStatus,now,now,
      ),
      env.DB.prepare(INSERT_EVIDENCE_SQL).bind(
        eventId,projectId,"PROJECT_REQUEST_ACCEPTED",state,correlationId,
        JSON.stringify({ service_ids: input.serviceIds, locale: input.locale }),now,
      ),
      env.DB.prepare(INSERT_OUTBOX_SQL).bind(
        outboxId,projectId,workflowInstanceId,"PENDING",0,now,now,
      ),
    ]);
  } catch (error) {
    const replay = await env.DB.prepare(
      "SELECT project_id,state,policy_status FROM project_requests WHERE idempotency_key = ? LIMIT 1"
    ).bind(idempotencyKey).first();
    if (replay) return json({ ...replay, replayed: true }, 200);
    console.error("project_request_write_failed", { correlationId, error: String(error) });
    return json({ error: "WRITE_FAILED", correlation_id: correlationId }, 503);
  }

  return json({
    project_id: projectId,
    state,
    policy_status: policyStatus,
    correlation_id: correlationId,
    next: "POLICY_CHECK",
  }, 202);
}

async function dispatchOutbox(env) {
  if (!env.DB || !env.PROJECT_WORKFLOW) return;
  const pending = await env.DB.prepare(
    "SELECT outbox_id,project_id,workflow_instance_id,attempts FROM dispatch_outbox WHERE status='PENDING' ORDER BY created_at LIMIT 20"
  ).all();
  for (const row of pending.results || []) {
    const now = new Date().toISOString();
    try {
      await env.PROJECT_WORKFLOW.create({ id: row.workflow_instance_id, params: { project_id: row.project_id } });
      await env.DB.batch([
        env.DB.prepare("UPDATE dispatch_outbox SET status='DISPATCHED',attempts=attempts+1,updated_at=? WHERE outbox_id=? AND status='PENDING'").bind(now,row.outbox_id),
        env.DB.prepare("UPDATE project_requests SET state='POLICY_CHECK',updated_at=? WHERE project_id=? AND state='VALIDATED'").bind(now,row.project_id),
      ]);
    } catch (error) {
      try {
        const instance = await env.PROJECT_WORKFLOW.get(row.workflow_instance_id);
        await instance.status();
        await env.DB.batch([
          env.DB.prepare("UPDATE dispatch_outbox SET status='DISPATCHED',attempts=attempts+1,updated_at=? WHERE outbox_id=?").bind(now,row.outbox_id),
          env.DB.prepare("UPDATE project_requests SET state='POLICY_CHECK',updated_at=? WHERE project_id=? AND state='VALIDATED'").bind(now,row.project_id),
        ]);
      } catch {
        await env.DB.prepare("UPDATE dispatch_outbox SET attempts=attempts+1,last_error=?,updated_at=? WHERE outbox_id=?").bind(String(error).slice(0,500),now,row.outbox_id).run();
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", service: "jadel-commercial-runtime", write_mode: "fail-closed" });
    }
    if (request.method === "POST" && url.pathname === "/api/v1/project-requests") {
      return handleProjectRequest(request, env);
    }
    return json({ error: "NOT_FOUND" }, 404);
  },
  async scheduled(_controller, env) {
    await dispatchOutbox(env);
  },
};
