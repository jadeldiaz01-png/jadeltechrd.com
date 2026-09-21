import { validateIdempotencyKey, validateProjectRequest } from "./validation.mjs";
import { buildRuntimeRevenueView } from "./revenue-intelligence.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_WEBHOOK_BYTES = 64 * 1024;
const TURNSTILE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const PAYPAL_API_BASE = "https://api-m.paypal.com";
const TURNSTILE_ACTION = "project_request";
const INSERT_REQUEST_SQL = `INSERT INTO project_requests
(project_id,idempotency_key,request_fingerprint,analytics_join_id,name,email,company,service_ids_json,notes,locale,state,policy_status,created_at,updated_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
const INSERT_EVIDENCE_SQL = `INSERT INTO evidence_events
(event_id,project_id,event_type,state,correlation_id,payload_json,created_at)
VALUES (?,?,?,?,?,?,?)`;
const INSERT_OUTBOX_SQL = `INSERT INTO dispatch_outbox
(outbox_id,project_id,workflow_instance_id,status,attempts,created_at,updated_at)
VALUES (?,?,?,?,?,?,?)`;
const INSERT_PAYMENT_EVENT_SQL = `INSERT INTO payment_events
(provider_event_id,provider,event_type,resource_id,resource_status,gross_amount,currency_code,raw_event_json,verification_status,received_at)
VALUES (?,?,?,?,?,?,?,?,?,?)`;
const INSERT_PAYMENT_LEDGER_SQL = `INSERT INTO payment_ledger
(ledger_id,provider_event_id,project_id,provider,ledger_state,amount_usd,currency_code,notes,created_at,updated_at)
VALUES (?,?,?,?,?,?,?,?,?,?)`;
const INSERT_APPROVAL_SQL = `INSERT INTO approval_events
(approval_id,project_id,approval_type,decision,actor,reason,evidence_json,created_at)
VALUES (?,?,?,?,?,?,?,?)`;
const INSERT_LEAD_LIFECYCLE_SQL = `INSERT INTO lead_lifecycle_events
(event_id,project_id,stage,source,source_event_id,evidence_json,created_at)
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

function bearerToken(request) {
  const value = request.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function exactPublicOrigin(request, env) {
  return request.headers.get("origin") === env.PUBLIC_ORIGIN;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(a)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(b)),
  ]);
  const left = new Uint8Array(leftDigest);
  const right = new Uint8Array(rightDigest);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    diff |= (left[index] || 0) ^ (right[index] || 0);
  }
  return diff === 0;
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
    lead_event_id: input.leadEventId,
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

async function readTextWithLimit(request, limit = MAX_WEBHOOK_BYTES) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > limit) throw new Error("REQUEST_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > limit) throw new Error("REQUEST_TOO_LARGE");
  return text;
}

function runtimeConfigured(env) {
  return Boolean(
    env.DB && env.PROJECT_REQUEST_RATE_LIMITER && env.TURNSTILE_SECRET_KEY &&
    env.PUBLIC_ORIGIN && env.PUBLIC_TURNSTILE_SITEKEY && env.TURNSTILE_EXPECTED_HOSTNAME
  );
}

function paypalWebhookConfigured(env) {
  return Boolean(env.DB && env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID);
}

function adminConfigured(env) {
  return Boolean(env?.DB && env?.ADMIN_API_TOKEN);
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
        projectId,idempotencyKey,fingerprint,input.leadEventId,input.name,input.email,input.company,
        JSON.stringify(input.serviceIds),input.notes,input.locale,state,policyStatus,now,now,
      ),
      env.DB.prepare(INSERT_EVIDENCE_SQL).bind(
        eventId,projectId,"PROJECT_REQUEST_ACCEPTED",state,correlationId,
        JSON.stringify({
          service_ids: input.serviceIds,
          locale: input.locale,
          request_fingerprint: fingerprint,
          analytics_join_id: input.leadEventId
        }),now,
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

async function paypalAccessToken(env, fetchImpl = fetch) {
  const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetchImpl(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "authorization": `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("PAYPAL_TOKEN_FAILED");
  const body = await response.json();
  if (!body?.access_token) throw new Error("PAYPAL_TOKEN_INVALID");
  return body.access_token;
}

async function verifyPayPalWebhook(headers, webhookEvent, env, fetchImpl = fetch) {
  const required = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: webhookEvent,
  };
  if (Object.entries(required).some(([key, value]) => key !== "webhook_event" && !value)) {
    return { ok: false, reason: "PAYPAL_HEADERS_MISSING" };
  }
  const token = await paypalAccessToken(env, fetchImpl);
  const response = await fetchImpl(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(required),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return { ok: false, reason: "PAYPAL_VERIFY_HTTP_ERROR" };
  const result = await response.json();
  return result?.verification_status === "SUCCESS"
    ? { ok: true }
    : { ok: false, reason: "PAYPAL_SIGNATURE_REJECTED" };
}

function paymentFacts(event) {
  const resource = event?.resource || {};
  const amount = resource?.amount || resource?.seller_receivable_breakdown?.gross_amount || {};
  return {
    providerEventId: String(event?.id || "").slice(0, 128),
    eventType: String(event?.event_type || "").slice(0, 128),
    resourceId: String(resource?.id || resource?.supplementary_data?.related_ids?.order_id || "").slice(0, 128),
    resourceStatus: String(resource?.status || "").slice(0, 64),
    grossAmount: String(amount?.value || "").slice(0, 32),
    currencyCode: String(amount?.currency_code || "").slice(0, 8),
  };
}

export async function handlePayPalWebhook(request, env, deps = {}) {
  if (!paypalWebhookConfigured(env)) return json({ error: "PAYPAL_WEBHOOK_NOT_CONFIGURED" }, 503);
  let raw;
  let event;
  try {
    raw = await readTextWithLimit(request);
    event = JSON.parse(raw);
  } catch (error) {
    const code = String(error?.message || "INVALID_WEBHOOK");
    return json({ error: code }, code === "REQUEST_TOO_LARGE" ? 413 : 400);
  }

  const verified = await verifyPayPalWebhook(request.headers, event, env, deps.fetchImpl);
  if (!verified.ok) {
    console.warn("paypal_webhook_rejected", { reason: verified.reason });
    return json({ error: "PAYPAL_WEBHOOK_REJECTED" }, 403);
  }

  const facts = paymentFacts(event);
  if (!facts.providerEventId || !facts.eventType) return json({ error: "PAYPAL_EVENT_INVALID" }, 400);

  const now = new Date().toISOString();
  const ledgerId = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare(INSERT_PAYMENT_EVENT_SQL).bind(
        facts.providerEventId,"paypal",facts.eventType,facts.resourceId,facts.resourceStatus,
        facts.grossAmount,facts.currencyCode,raw,"VERIFIED",now,
      ),
      env.DB.prepare(INSERT_PAYMENT_LEDGER_SQL).bind(
        ledgerId,facts.providerEventId,null,"paypal","REQUIRES_HUMAN",facts.grossAmount,
        facts.currencyCode,"Webhook verified; project match and fulfillment require human reconciliation.",now,now,
      ),
    ]);
  } catch (error) {
    const existing = await env.DB.prepare(
      "SELECT provider_event_id FROM payment_events WHERE provider_event_id=? LIMIT 1"
    ).bind(facts.providerEventId).first();
    if (existing) return json({ received: true, replayed: true }, 200);
    console.error("paypal_webhook_write_failed", { event_id: facts.providerEventId, error: String(error) });
    return json({ error: "PAYMENT_WRITE_FAILED" }, 503);
  }

  return json({ received: true, provider_event_id: facts.providerEventId, ledger_state: "REQUIRES_HUMAN" }, 202);
}

async function requireAdmin(request, env) {
  return adminConfigured(env) && await constantTimeEqual(bearerToken(request), env.ADMIN_API_TOKEN);
}

export async function handleAdminApprovals(request, env) {
  if (!adminConfigured(env)) return json({ error: "ADMIN_NOT_CONFIGURED" }, 503);
  if (!await requireAdmin(request, env)) return json({ error: "UNAUTHORIZED" }, 401, { "www-authenticate": "Bearer" });
  if (request.method === "GET") {
    const pending = await env.DB.prepare(
      "SELECT project_id,name,email,company,service_ids_json,state,policy_status,created_at,updated_at FROM project_requests WHERE policy_status IN ('PENDING','REQUIRES_HUMAN') ORDER BY created_at DESC LIMIT 50"
    ).all();
    const payments = await env.DB.prepare(
      "SELECT ledger_id,provider_event_id,ledger_state,amount_usd,currency_code,created_at FROM payment_ledger WHERE ledger_state IN ('RECEIVED','RECONCILING','REQUIRES_HUMAN') ORDER BY created_at DESC LIMIT 50"
    ).all();
    return json({ projects: pending.results || [], payments: payments.results || [] });
  }
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let input;
  try { input = await readJsonWithLimit(request); } catch { return json({ error: "INVALID_APPROVAL_REQUEST" }, 400); }
  const projectId = typeof input.project_id === "string" && /^[0-9a-f-]{36}$/i.test(input.project_id) ? input.project_id : null;
  const decision = typeof input.decision === "string" ? input.decision.toUpperCase() : "";
  const approvalType = typeof input.approval_type === "string" ? input.approval_type.slice(0, 80) : "policy";
  const reason = typeof input.reason === "string" ? input.reason.slice(0, 500) : "";
  if (!projectId || !new Set(["APPROVED","DENIED","NEEDS_INFO"]).has(decision)) {
    return json({ error: "INVALID_APPROVAL_REQUEST" }, 400);
  }
  const existingProject = await env.DB.prepare(
    "SELECT project_id FROM project_requests WHERE project_id=? LIMIT 1"
  ).bind(projectId).first();
  if (!existingProject) return json({ error: "PROJECT_NOT_FOUND" }, 404);

  const now = new Date().toISOString();
  const approvalId = crypto.randomUUID();
  const nextPolicy = decision === "APPROVED" ? "ALLOWED" : decision === "DENIED" ? "DENIED" : "REQUIRES_HUMAN";
  const nextState = decision === "APPROVED" ? "POLICY_ALLOWED" : "POLICY_CHECK";
  await env.DB.batch([
    env.DB.prepare(INSERT_APPROVAL_SQL).bind(
      approvalId,projectId,approvalType,decision,"admin",reason,JSON.stringify({ source: "approval_console" }),now,
    ),
    env.DB.prepare("UPDATE project_requests SET state=?,policy_status=?,updated_at=? WHERE project_id=?").bind(
      nextState,nextPolicy,now,projectId,
    ),
  ]);
  return json({ approval_id: approvalId, project_id: projectId, state: nextState, policy_status: nextPolicy });
}

const LEAD_STAGES = new Set([
  "working_lead","qualify_lead","disqualify_lead","close_convert_lead","close_unconvert_lead"
]);
const LEAD_REASON_CODES = new Set([
  "OPERATOR_CONSOLE","CUSTOMER_CONFIRMED","PAYMENT_RECONCILED","NOT_FIT","NO_RESPONSE","OTHER"
]);
const TERMINAL_LEAD_STAGES = new Set(["disqualify_lead","close_convert_lead","close_unconvert_lead"]);

function leadTransitionAllowed(previousStage, nextStage) {
  if (!previousStage) return nextStage === "working_lead";
  if (previousStage === "working_lead") return nextStage === "qualify_lead" || nextStage === "disqualify_lead";
  if (previousStage === "qualify_lead") return nextStage === "close_convert_lead" || nextStage === "close_unconvert_lead";
  return false;
}

export async function handleAdminLeadLifecycle(request, env) {
  if (!adminConfigured(env)) return json({ error: "ADMIN_NOT_CONFIGURED" }, 503);
  if (!await requireAdmin(request, env)) return json({ error: "UNAUTHORIZED" }, 401, { "www-authenticate": "Bearer" });

  if (request.method === "GET") {
    const [projects, counts] = await Promise.all([
      env.DB.prepare(`
        SELECT
          p.project_id,p.name,p.email,p.service_ids_json,p.state,p.policy_status,p.created_at,
          (SELECT e.stage FROM lead_lifecycle_events e
           WHERE e.project_id=p.project_id
           ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) AS latest_stage
        FROM project_requests p
        ORDER BY p.created_at DESC
        LIMIT 100
      `).all(),
      env.DB.prepare(`
        SELECT stage,COUNT(*) AS event_count,COUNT(DISTINCT project_id) AS project_count
        FROM lead_lifecycle_events
        GROUP BY stage
        ORDER BY stage
      `).all(),
    ]);
    const rows = counts.results || [];
    const countFor = (stage) => Number(rows.find((row) => row.stage === stage)?.project_count || 0);
    return json({
      projects: projects.results || [],
      summary: {
        working_lead: countFor("working_lead"),
        qualify_lead: countFor("qualify_lead"),
        disqualify_lead: countFor("disqualify_lead"),
        close_convert_lead: countFor("close_convert_lead"),
        close_unconvert_lead: countFor("close_unconvert_lead"),
        positive_terminal_labels: countFor("close_convert_lead"),
        negative_terminal_labels: countFor("disqualify_lead") + countFor("close_unconvert_lead"),
      }
    });
  }

  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let input;
  try { input = await readJsonWithLimit(request); } catch { return json({ error: "INVALID_LEAD_LABEL_REQUEST" }, 400); }
  const allowedFields = new Set(["project_id","stage","source_event_id","reason_code"]);
  for (const key of Object.keys(input || {})) {
    if (!allowedFields.has(key)) return json({ error: "INVALID_LEAD_LABEL_REQUEST" }, 400);
  }
  const projectId = typeof input.project_id === "string" && /^[0-9a-f-]{36}$/i.test(input.project_id) ? input.project_id : null;
  const stage = typeof input.stage === "string" ? input.stage : "";
  const sourceEventId = typeof input.source_event_id === "string" ? input.source_event_id : "";
  const reasonCode = typeof input.reason_code === "string" ? input.reason_code : "OTHER";
  if (!projectId || !LEAD_STAGES.has(stage) || !/^[A-Za-z0-9_-]{16,128}$/.test(sourceEventId) || !LEAD_REASON_CODES.has(reasonCode)) {
    return json({ error: "INVALID_LEAD_LABEL_REQUEST" }, 400);
  }

  const project = await env.DB.prepare(
    "SELECT project_id FROM project_requests WHERE project_id=? LIMIT 1"
  ).bind(projectId).first();
  if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);

  const replay = await env.DB.prepare(
    "SELECT event_id,project_id,stage FROM lead_lifecycle_events WHERE source='human' AND source_event_id=? LIMIT 1"
  ).bind(sourceEventId).first();
  if (replay) {
    if (replay.project_id !== projectId || replay.stage !== stage) return json({ error: "LEAD_LABEL_IDEMPOTENCY_CONFLICT" }, 409);
    return json({ event_id: replay.event_id, project_id: projectId, stage, replayed: true });
  }

  const latest = await env.DB.prepare(
    "SELECT stage FROM lead_lifecycle_events WHERE project_id=? ORDER BY created_at DESC,event_id DESC LIMIT 1"
  ).bind(projectId).first();
  const previousStage = latest?.stage || null;
  if (TERMINAL_LEAD_STAGES.has(previousStage || "") || !leadTransitionAllowed(previousStage, stage)) {
    return json({ error: "INVALID_LEAD_STAGE_TRANSITION", previous_stage: previousStage, requested_stage: stage }, 409);
  }

  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  await env.DB.prepare(INSERT_LEAD_LIFECYCLE_SQL).bind(
    eventId,projectId,stage,"human",sourceEventId,
    JSON.stringify({ reason_code: reasonCode, source: "approval_console" }),now,
  ).run();
  return json({ event_id: eventId, project_id: projectId, stage, previous_stage: previousStage, replayed: false }, 201);
}

export async function handleAdminRevenueIntelligence(request, env) {
  if (!adminConfigured(env)) return json({ error: "ADMIN_NOT_CONFIGURED" }, 503);
  if (!await requireAdmin(request, env)) return json({ error: "UNAUTHORIZED" }, 401, { "www-authenticate": "Bearer" });
  if (request.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const view = await buildRuntimeRevenueView(env.DB);
    return json({
      ...view,
      generated_at: new Date().toISOString(),
      authority: "RECOMMEND_ONLY",
      production_authorized: false,
    });
  } catch (error) {
    console.error("revenue_intelligence_read_failed", { error: String(error?.name || "Error") });
    return json({ error: "REVENUE_INTELLIGENCE_UNAVAILABLE" }, 503);
  }
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
    if (request.method === "POST" && url.pathname === "/api/v1/paypal/webhooks") {
      return handlePayPalWebhook(request, env);
    }
    if (url.pathname === "/api/v1/admin/approvals") {
      return handleAdminApprovals(request, env);
    }
    if (url.pathname === "/api/v1/admin/revenue-intelligence") {
      return handleAdminRevenueIntelligence(request, env);
    }
    if (url.pathname === "/api/v1/admin/lead-lifecycle") {
      return handleAdminLeadLifecycle(request, env);
    }
    return json({ error: "NOT_FOUND" }, 404);
  },
  async scheduled(_controller, env) {
    await dispatchOutbox(env);
  },
};
