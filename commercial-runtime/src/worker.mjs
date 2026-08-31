import { validateIdempotencyKey, validateProjectRequest } from "./validation.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const TURNSTILE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "project_request";
const INSERT_REQUEST_SQL = `INSERT INTO project_requests
(project_id,idempotency_key,request_fingerprint,name,email,company,service_ids_json,notes,locale,state,policy_status,created_at,updated_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
const INSERT_EVIDENCE_SQL = `INSERT INTO evidence_events
(event_id,project_id,event_type,state,correlation_id,payload_json,created_at)
VALUES (?,?,?,?,?,?,?)`;
const INSERT_OUTBOX_SQL = `INSERT INTO dispatch_outbox
(outbox_id,project_id,workflow_instance_id,status,attempts,created_at,updated_at)
VALUES (?,?,?,?,?,?,?)`;

function baseHeaders(extraHeaders = {}) {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...extraHeaders,
  };
}

function corsHeaders(origin, env) {
  if (!origin || origin !== env.PUBLIC_ORIGIN) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,idempotency-key",
    "access-control-max-age": "600",
    "vary": "Origin",
  };
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders(extraHeaders) });
}

function exactPublicOrigin(request, env) {
  return request.headers.get("origin") === env.PUBLIC_ORIGIN;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function stableRateKey(request) {
  const raw = `${request.headers.get("cf-connecting-ip") || "unknown"}|${request.headers.get("user-agent") || "unknown"}`;
  return sha256Hex(raw);
}

async function requestFingerprint(input) {
  return sha256Hex(JSON.stringify({
    name: input.name,
    email: input.email,
    company: input.company,
    service_ids: input.serviceIds,
    notes: input.notes,
    locale: input.locale,
  }));
}

export async function verifyTurnstile(token, env, remoteIp, fetchImpl = fetch) {
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  form.set("idempotency_key", crypto.randomUUID());
  if (remoteIp) form.set("remoteip", remoteIp);

  let response;
  try {
    response = await fetchImpl(TURNSTILE_SITEVERIFY, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, reason: "SITEVERIFY_UNAVAILABLE" };
  }
  if (!response.ok) return { ok: false, reason: "SITEVERIFY_HTTP_ERROR" };

  let result;
  try { result = await response.json(); } catch { return { ok: false, reason: "SITEVERIFY_INVALID_RESPONSE" }; }
  if (result.success !== true) return { ok: false, reason: "TURNSTILE_REJECTED" };
  if (result.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME) return { ok: false, reason: "TURNSTILE_HOSTNAME_MISMATCH" };
  if (result.action !== TURNSTILE_ACTION) return { ok: false, reason: "TURNSTILE_ACTION_MISMATCH" };
  return { ok: true };
}

async function readJsonWithLimit(request) {
  const type = (request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") throw new Error("UNSUPPORTED_CONTENT_TYPE");
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");
  try { return JSON.parse(text); } catch { throw new Error("INVALID_JSON"); }
}

function runtimeConfigured(env) {
  return Boolean(
    env.DB && env.PROJECT_REQUEST_RATE_LIMITER && env.TURNSTILE_SECRET_KEY &&
    env.PUBLIC_ORIGIN && env.PUBLIC_TURNSTILE_SITEKEY && env.TURNSTILE_EXPECTED_HOSTNAME
  );
}

async function lookupByIdempotency(env, key) {
  return env.DB.prepare(
    "SELECT project_id,state,policy_status,request_fingerprint FROM project_requests WHERE idempotency_key = ? LIMIT 1"
  ).bind(key).first();
}

export async function handleProjectRequest(request, env, deps = {}) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin, env);
  if (!exactPublicOrigin(request, env)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, cors);
  if (!runtimeConfigured(env)) return json({ error: "RUNTIME_NOT_CONFIGURED" }, 503, cors);

  const rateKey = await stableRateKey(request);
  const limit = await env.PROJECT_REQUEST_RATE_LIMITER.limit({ key: `project:${rateKey}` });
  if (!limit.success) return json({ error: "RATE_LIMITED" }, 429, { ...cors, "retry-after": "60" });

  let idempotencyKey;
  let input;
  try {
    idempotencyKey = validateIdempotencyKey(request.headers.get("idempotency-key"));
    input = validateProjectRequest(await readJsonWithLimit(request));
  } catch (error) {
    const code = String(error?.message || "INVALID_REQUEST");
    const status = code === "REQUEST_TOO_LARGE" ? 413 : code === "UNSUPPORTED_CONTENT_TYPE" ? 415 : 400;
    return json({ error: code }, status, cors);
  }

  const fingerprint = await requestFingerprint(input);
  const existing = await lookupByIdempotency(env, idempotencyKey);
  if (existing) {
    if (!existing.request_fingerprint || existing.request_fingerprint !== fingerprint) {
      return json({ error: "IDEMPOTENCY_CONFLICT" }, 409, cors);
    }
    return json({ project_id: existing.project_id, state: existing.state, policy_status: existing.policy_status, replayed: true }, 200, cors);
  }

  const turnstile = await verifyTurnstile(
    input.turnstileToken,
    env,
    request.headers.get("cf-connecting-ip"),
    deps.fetchImpl,
  );
  if (!turnstile.ok) {
    console.warn("turnstile_rejected", { reason: turnstile.reason });
    return json({ error: "TURNSTILE_FAILED" }, 403, cors);
  }

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
        projectId,idempotencyKey,fingerprint,input.name,input.email,input.company,
        JSON.stringify(input.serviceIds),input.notes,input.locale,state,policyStatus,now,now,
      ),
      env.DB.prepare(INSERT_EVIDENCE_SQL).bind(
        eventId,projectId,"PROJECT_REQUEST_ACCEPTED",state,correlationId,
        JSON.stringify({ service_ids: input.serviceIds, locale: input.locale, request_fingerprint: fingerprint }),now,
      ),
      env.DB.prepare(INSERT_OUTBOX_SQL).bind(
        outboxId,projectId,workflowInstanceId,"PENDING",0,now,now,
      ),
    ]);
  } catch (error) {
    const replay = await lookupByIdempotency(env, idempotencyKey);
    if (replay && replay.request_fingerprint === fingerprint) {
      return json({ project_id: replay.project_id, state: replay.state, policy_status: replay.policy_status, replayed: true }, 200, cors);
    }
    console.error("project_request_write_failed", { correlationId, error: String(error) });
    return json({ error: "WRITE_FAILED", correlation_id: correlationId }, 503, cors);
  }

  return json({
    project_id: projectId,
    state,
    policy_status: policyStatus,
    correlation_id: correlationId,
    next: "POLICY_CHECK",
  }, 202, cors);
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
    const origin = request.headers.get("origin");

    if (request.method === "OPTIONS" && url.pathname === "/api/v1/project-requests") {
      if (!exactPublicOrigin(request, env)) return new Response(null, { status: 403, headers: baseHeaders() });
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", service: "jadel-commercial-runtime", write_mode: "fail-closed" });
    }
    if (request.method === "GET" && url.pathname === "/api/v1/public-config") {
      if (!exactPublicOrigin(request, env)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
      if (!runtimeConfigured(env)) return json({ error: "RUNTIME_NOT_CONFIGURED" }, 503, corsHeaders(origin, env));
      return json({ turnstile_sitekey: env.PUBLIC_TURNSTILE_SITEKEY, turnstile_action: TURNSTILE_ACTION }, 200, corsHeaders(origin, env));
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
