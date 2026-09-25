import { validateIdempotencyKey, validateProjectRequest } from "./validation.mjs";
import { buildRuntimeRevenueView } from "./revenue-intelligence.mjs";
import { loadApprovedOpportunityFeed } from "./revenue-agent-bridge.mjs";
import { buildRevenueRuntimeAuthorization } from "./revenue-agent-authorization.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_WEBHOOK_BYTES = 64 * 1024;
const TURNSTILE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const PAYPAL_API_BASE = "https://api-m.paypal.com";
const PAYPAL_CERT_HOSTS = new Set(["api-m.paypal.com", "api-m.sandbox.paypal.com"]);
const PAYPAL_LEDGER_EVENT_STATES = new Map([
  ["PAYMENT.CAPTURE.COMPLETED", "REQUIRES_HUMAN"],
  ["PAYMENT.CAPTURE.PENDING", "RECONCILING"],
  ["PAYMENT.CAPTURE.DENIED", "REJECTED"],
  ["PAYMENT.CAPTURE.REFUNDED", "REJECTED"],
  ["PAYMENT.CAPTURE.REVERSED", "REJECTED"],
  ["PAYMENT.SALE.COMPLETED", "REQUIRES_HUMAN"],
  ["PAYMENT.SALE.REFUNDED", "REJECTED"],
  ["PAYMENT.SALE.REVERSED", "REJECTED"],
]);
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
const INSERT_PAYMENT_EVENT_SQL = `INSERT INTO payment_events
(provider_event_id,provider,event_type,resource_id,resource_status,gross_amount,currency_code,raw_event_json,verification_status,received_at)
VALUES (?,?,?,?,?,?,?,?,?,?)`;
const INSERT_PAYMENT_LEDGER_SQL = `INSERT INTO payment_ledger
(ledger_id,provider_event_id,project_id,provider,ledger_state,amount_usd,currency_code,notes,created_at,updated_at)
VALUES (?,?,?,?,?,?,?,?,?,?)`;
const INSERT_APPROVAL_SQL = `INSERT INTO approval_events
(approval_id,project_id,approval_type,decision,actor,reason,evidence_json,created_at)
VALUES (?,?,?,?,?,?,?,?)`;

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

function revenueAgentConfigured(env) {
  return Boolean(env?.DB && env?.REVENUE_AGENT_API_TOKEN);
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
  const certUrl = headers.get("paypal-cert-url");
  const required = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: certUrl,
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: webhookEvent,
  };
  if (Object.entries(required).some(([key, value]) => key !== "webhook_event" && !value)) {
    return { ok: false, reason: "PAYPAL_HEADERS_MISSING" };
  }
  try {
    const parsedCertUrl = new URL(certUrl);
    if (parsedCertUrl.protocol !== "https:" || !PAYPAL_CERT_HOSTS.has(parsedCertUrl.hostname)) {
      return { ok: false, reason: "PAYPAL_CERT_URL_REJECTED" };
    }
  } catch {
    return { ok: false, reason: "PAYPAL_CERT_URL_REJECTED" };
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
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
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

  let verified;
  try {
    verified = await verifyPayPalWebhook(request.headers, event, env, deps.fetchImpl);
  } catch (error) {
    console.warn("paypal_webhook_verify_unavailable", { error: String(error?.message || "PAYPAL_VERIFY_UNAVAILABLE") });
    return json({ error: "PAYPAL_VERIFY_UNAVAILABLE" }, 503);
  }
  if (!verified.ok) {
    console.warn("paypal_webhook_rejected", { reason: verified.reason });
    return json({ error: "PAYPAL_WEBHOOK_REJECTED" }, 403);
  }

  const facts = paymentFacts(event);
  if (!facts.providerEventId || !facts.eventType) return json({ error: "PAYPAL_EVENT_INVALID" }, 400);
  const ledgerState = PAYPAL_LEDGER_EVENT_STATES.get(facts.eventType);
  if (!ledgerState) {
    return json({ received: true, ignored: true, event_type: facts.eventType }, 202);
  }

  const now = new Date().toISOString();
  const ledgerId = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare(INSERT_PAYMENT_EVENT_SQL).bind(
        facts.providerEventId,"paypal",facts.eventType,facts.resourceId,facts.resourceStatus,
        facts.grossAmount,facts.currencyCode,raw,"VERIFIED",now,
      ),
      env.DB.prepare(INSERT_PAYMENT_LEDGER_SQL).bind(
        ledgerId,facts.providerEventId,null,"paypal",ledgerState,facts.grossAmount,
        facts.currencyCode,"Webhook verified; project match and fulfillment require owner reconciliation.",now,now,
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

  return json({ received: true, provider_event_id: facts.providerEventId, ledger_state: ledgerState }, 202);
}

async function requireAdmin(request, env) {
  return adminConfigured(env) && await constantTimeEqual(bearerToken(request), env.ADMIN_API_TOKEN);
}

async function requireRevenueAgent(request, env) {
  return revenueAgentConfigured(env) && await constantTimeEqual(bearerToken(request), env.REVENUE_AGENT_API_TOKEN);
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
    const paymentOrders = await env.DB.prepare(
      "SELECT payment_order_id,quote_id,project_id,status,amount_minor,currency_code,created_at FROM payment_orders WHERE status='PENDING' ORDER BY created_at DESC LIMIT 50"
    ).all();
    return json({
      projects: pending.results || [],
      payments: payments.results || [],
      payment_orders: paymentOrders.results || [],
    });
  }
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let input;
  try { input = await readJsonWithLimit(request); } catch { return json({ error: "INVALID_APPROVAL_REQUEST" }, 400); }
  const projectId = typeof input.project_id === "string" && /^[0-9a-f-]{36}$/i.test(input.project_id) ? input.project_id : null;
  const ledgerId = typeof input.ledger_id === "string" && /^[0-9a-f-]{36}$/i.test(input.ledger_id) ? input.ledger_id : null;
  const decision = typeof input.decision === "string" ? input.decision.toUpperCase() : "";
  const approvalType = typeof input.approval_type === "string" ? input.approval_type.slice(0, 80) : "policy";
  const reason = typeof input.reason === "string" ? input.reason.slice(0, 500) : "";
  if ((!projectId && !ledgerId) || !new Set(["APPROVED","DENIED","NEEDS_INFO"]).has(decision)) {
    return json({ error: "INVALID_APPROVAL_REQUEST" }, 400);
  }
  if (ledgerId) {
    if (decision === "APPROVED" && !projectId) return json({ error: "PROJECT_REQUIRED_FOR_PAYMENT_MATCH" }, 400);
    if (decision === "APPROVED") return json({ error: "USE_PAYMENT_RECONCILIATION_CONTRACT" }, 409);
    const ledger = await env.DB.prepare(
      "SELECT ledger_id,provider_event_id,ledger_state FROM payment_ledger WHERE ledger_id=? LIMIT 1"
    ).bind(ledgerId).first();
    if (!ledger) return json({ error: "LEDGER_NOT_FOUND" }, 404);
    if (!new Set(["RECEIVED","RECONCILING","REQUIRES_HUMAN"]).has(ledger.ledger_state)) {
      return json({ error: "LEDGER_STATE_NOT_RECONCILABLE" }, 409);
    }
    if (decision === "APPROVED" && ledger.ledger_state !== "REQUIRES_HUMAN") {
      return json({ error: "LEDGER_STATE_NOT_MATCHABLE" }, 409);
    }
    if (projectId) {
      const project = await env.DB.prepare(
        "SELECT project_id FROM project_requests WHERE project_id=? LIMIT 1"
      ).bind(projectId).first();
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
    }

    const now = new Date().toISOString();
    const approvalId = crypto.randomUUID();
    const nextLedgerState = decision === "APPROVED" ? "MATCHED" : decision === "DENIED" ? "REJECTED" : "REQUIRES_HUMAN";
    const ledgerNote = decision === "APPROVED"
      ? "Owner reconciled PayPal payment with project. Fulfillment still requires delivery controls."
      : decision === "DENIED"
        ? "Owner rejected PayPal payment reconciliation."
        : "Owner requested more payment reconciliation evidence.";
    const ledgerApprovalType = approvalType === "policy" ? "payment_reconciliation" : approvalType;
    await env.DB.batch([
      env.DB.prepare(INSERT_APPROVAL_SQL).bind(
        approvalId,projectId,ledgerApprovalType,decision,"admin",reason,
        JSON.stringify({ source: "approval_console", ledger_id: ledgerId, provider_event_id: ledger.provider_event_id }),now,
      ),
      env.DB.prepare("UPDATE payment_ledger SET project_id=?,ledger_state=?,notes=?,updated_at=? WHERE ledger_id=?").bind(
        projectId,nextLedgerState,ledgerNote,now,ledgerId,
      ),
    ]);
    return json({ approval_id: approvalId, project_id: projectId, ledger_id: ledgerId, ledger_state: nextLedgerState });
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


const QUOTE_ID_RE = /^[0-9a-f-]{36}$/i;
const SALES_SERVICE_ID_RE = /^[a-z0-9-]{1,64}$/;
const MAX_QUOTE_ITEMS = 20;
const MAX_MINOR_AMOUNT = 100_000_000;

function normalizeCurrency(value) {
  const currency = String(value || "USD").trim().toUpperCase();
  if (currency !== "USD") throw new Error("UNSUPPORTED_CURRENCY");
  return currency;
}

function normalizeQuoteItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_QUOTE_ITEMS) {
    throw new Error("INVALID_QUOTE_ITEMS");
  }
  let total = 0;
  const normalized = items.map((item) => {
    const serviceId = String(item?.service_id || "").trim();
    const description = String(item?.description || serviceId).trim().slice(0, 160);
    const quantity = Number(item?.quantity ?? 1);
    const unitAmountMinor = Number(item?.unit_amount_minor);
    if (!SALES_SERVICE_ID_RE.test(serviceId) || !description) throw new Error("INVALID_QUOTE_ITEM");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw new Error("INVALID_QUOTE_ITEM_QUANTITY");
    if (!Number.isSafeInteger(unitAmountMinor) || unitAmountMinor < 0 || unitAmountMinor > MAX_MINOR_AMOUNT) {
      throw new Error("INVALID_QUOTE_ITEM_AMOUNT");
    }
    const lineAmountMinor = quantity * unitAmountMinor;
    if (!Number.isSafeInteger(lineAmountMinor) || lineAmountMinor > MAX_MINOR_AMOUNT) {
      throw new Error("INVALID_QUOTE_TOTAL");
    }
    total += lineAmountMinor;
    if (!Number.isSafeInteger(total) || total > MAX_MINOR_AMOUNT) throw new Error("INVALID_QUOTE_TOTAL");
    return { serviceId, description, quantity, unitAmountMinor, lineAmountMinor };
  });
  return { items: normalized, totalAmountMinor: total };
}

function providerAmountToMinor(value) {
  const text = String(value || "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("PAYMENT_AMOUNT_INVALID");
  const [whole, fraction = ""] = text.split(".");
  const minor = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > MAX_MINOR_AMOUNT) {
    throw new Error("PAYMENT_AMOUNT_INVALID");
  }
  return minor;
}

export async function handleAdminQuoteCreate(request, env) {
  if (!adminConfigured(env)) return json({ error: "ADMIN_NOT_CONFIGURED" }, 503);
  if (!await requireAdmin(request, env)) return json({ error: "UNAUTHORIZED" }, 401, { "www-authenticate": "Bearer" });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let input;
  let normalized;
  try {
    input = await readJsonWithLimit(request);
    normalized = normalizeQuoteItems(input.items);
  } catch (error) {
    return json({ error: String(error?.message || "INVALID_QUOTE_REQUEST") }, 400);
  }

  const projectId = typeof input.project_id === "string" && QUOTE_ID_RE.test(input.project_id) ? input.project_id : null;
  if (!projectId) return json({ error: "INVALID_PROJECT_ID" }, 400);

  let currency;
  try { currency = normalizeCurrency(input.currency_code); }
  catch (error) { return json({ error: String(error.message) }, 400); }

  const project = await env.DB.prepare(
    "SELECT project_id,state,policy_status FROM project_requests WHERE project_id=? LIMIT 1"
  ).bind(projectId).first();
  if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
  if (project.policy_status !== "ALLOWED" || !new Set(["POLICY_ALLOWED","QUOTED"]).has(project.state)) {
    return json({ error: "PROJECT_NOT_QUOTABLE" }, 409);
  }

  const versionRow = await env.DB.prepare(
    "SELECT COALESCE(MAX(version),0) AS version FROM quotes WHERE project_id=?"
  ).bind(projectId).first();
  const version = Number(versionRow?.version || 0) + 1;
  const quoteId = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = typeof input.expires_at === "string" && !Number.isNaN(Date.parse(input.expires_at))
    ? new Date(input.expires_at).toISOString()
    : null;

  const statements = [
    env.DB.prepare(
      "INSERT INTO quotes (quote_id,project_id,version,status,currency_code,total_amount_minor,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).bind(quoteId,projectId,version,"ISSUED",currency,normalized.totalAmountMinor,expiresAt,now,now),
    ...normalized.items.map((item) => env.DB.prepare(
      "INSERT INTO quote_items (quote_item_id,quote_id,service_id,description,quantity,unit_amount_minor,line_amount_minor,created_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(crypto.randomUUID(),quoteId,item.serviceId,item.description,item.quantity,item.unitAmountMinor,item.lineAmountMinor,now)),
    env.DB.prepare(
      "UPDATE project_requests SET state='QUOTED',updated_at=? WHERE project_id=? AND policy_status='ALLOWED'"
    ).bind(now,projectId),
  ];
  await env.DB.batch(statements);
  return json({
    quote_id:quoteId,
    project_id:projectId,
    version,
    status:"ISSUED",
    currency_code:currency,
    total_amount_minor:normalized.totalAmountMinor,
    external_side_effect:false,
  }, 201);
}

export async function handleAdminQuoteAcceptance(request, env) {
  if (!adminConfigured(env)) return json({ error: "ADMIN_NOT_CONFIGURED" }, 503);
  if (!await requireAdmin(request, env)) return json({ error: "UNAUTHORIZED" }, 401, { "www-authenticate": "Bearer" });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let input;
  try { input = await readJsonWithLimit(request); }
  catch { return json({ error: "INVALID_QUOTE_ACCEPTANCE" }, 400); }
  const quoteId = typeof input.quote_id === "string" && QUOTE_ID_RE.test(input.quote_id) ? input.quote_id : null;
  const evidence = typeof input.acceptance_evidence === "string" ? input.acceptance_evidence.trim().slice(0, 500) : "";
  if (!quoteId || !evidence) return json({ error: "QUOTE_ACCEPTANCE_EVIDENCE_REQUIRED" }, 400);

  const quote = await env.DB.prepare(
    "SELECT q.quote_id,q.project_id,q.status,p.state AS project_state,p.policy_status FROM quotes q JOIN project_requests p ON p.project_id=q.project_id WHERE q.quote_id=? LIMIT 1"
  ).bind(quoteId).first();
  if (!quote) return json({ error: "QUOTE_NOT_FOUND" }, 404);
  if (quote.status !== "ISSUED" || quote.policy_status !== "ALLOWED" || !new Set(["QUOTED","POLICY_ALLOWED"]).has(quote.project_state)) {
    return json({ error: "QUOTE_NOT_ACCEPTABLE" }, 409);
  }

  const now = new Date().toISOString();
  const approvalId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(INSERT_APPROVAL_SQL).bind(
      approvalId,quote.project_id,"quote_acceptance","APPROVED","admin",
      "Operator recorded customer quote acceptance.",
      JSON.stringify({ quote_id:quoteId, acceptance_evidence:evidence }),now,
    ),
    env.DB.prepare("UPDATE quotes SET status='ACCEPTED',accepted_at=?,updated_at=? WHERE quote_id=? AND status='ISSUED'")
      .bind(now,now,quoteId),
    env.DB.prepare("UPDATE project_requests SET state='CUSTOMER_APPROVED',updated_at=? WHERE project_id=?")
      .bind(now,quote.project_id),
  ]);
  return json({
    quote_id:quoteId,
    project_id:quote.project_id,
    quote_status:"ACCEPTED",
    project_state:"CUSTOMER_APPROVED",
    approval_id:approvalId,
  }, 200);
}

export async function handleAdminPaymentOrderCreate(request, env) {
  if (!adminConfigured(env)) return json({ error: "ADMIN_NOT_CONFIGURED" }, 503);
  if (!await requireAdmin(request, env)) return json({ error: "UNAUTHORIZED" }, 401, { "www-authenticate": "Bearer" });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let input;
  try { input = await readJsonWithLimit(request); }
  catch { return json({ error: "INVALID_PAYMENT_ORDER_REQUEST" }, 400); }
  const quoteId = typeof input.quote_id === "string" && QUOTE_ID_RE.test(input.quote_id) ? input.quote_id : null;
  if (!quoteId) return json({ error: "INVALID_QUOTE_ID" }, 400);

  const quote = await env.DB.prepare(
    "SELECT q.quote_id,q.project_id,q.status,q.currency_code,q.total_amount_minor,p.state AS project_state,p.policy_status FROM quotes q JOIN project_requests p ON p.project_id=q.project_id WHERE q.quote_id=? LIMIT 1"
  ).bind(quoteId).first();
  if (!quote) return json({ error: "QUOTE_NOT_FOUND" }, 404);
  if (quote.status !== "ACCEPTED" || quote.policy_status !== "ALLOWED" || quote.project_state !== "CUSTOMER_APPROVED") {
    return json({ error: "QUOTE_NOT_READY_FOR_PAYMENT" }, 409);
  }

  const existing = await env.DB.prepare(
    "SELECT payment_order_id,status FROM payment_orders WHERE quote_id=? AND status IN ('PENDING','COMPLETED') ORDER BY created_at DESC LIMIT 1"
  ).bind(quoteId).first();
  if (existing) return json({ error: "PAYMENT_ORDER_ALREADY_EXISTS", payment_order_id:existing.payment_order_id }, 409);

  const paymentOrderId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO payment_orders (payment_order_id,quote_id,project_id,provider,provider_order_id,status,amount_minor,currency_code,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(paymentOrderId,quoteId,quote.project_id,"paypal","", "PENDING",quote.total_amount_minor,quote.currency_code,now,now),
    env.DB.prepare("UPDATE project_requests SET state='PAYMENT_PENDING',updated_at=? WHERE project_id=?")
      .bind(now,quote.project_id),
  ]);

  return json({
    payment_order_id:paymentOrderId,
    quote_id:quoteId,
    project_id:quote.project_id,
    status:"PENDING",
    amount_minor:quote.total_amount_minor,
    currency_code:quote.currency_code,
    provider:"paypal",
    provider_call_performed:false,
    financial_execution_authorized:false,
  }, 201);
}

export async function handleAdminPaymentReconciliation(request, env) {
  if (!adminConfigured(env)) return json({ error: "ADMIN_NOT_CONFIGURED" }, 503);
  if (!await requireAdmin(request, env)) return json({ error: "UNAUTHORIZED" }, 401, { "www-authenticate": "Bearer" });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let input;
  try { input = await readJsonWithLimit(request); } catch { return json({ error: "INVALID_RECONCILIATION_REQUEST" }, 400); }
  const projectId = typeof input.project_id === "string" && QUOTE_ID_RE.test(input.project_id) ? input.project_id : null;
  const ledgerId = typeof input.ledger_id === "string" && QUOTE_ID_RE.test(input.ledger_id) ? input.ledger_id : null;
  const paymentOrderId = typeof input.payment_order_id === "string" && QUOTE_ID_RE.test(input.payment_order_id) ? input.payment_order_id : null;
  const decision = typeof input.decision === "string" ? input.decision.toUpperCase() : "";
  const reason = typeof input.reason === "string" ? input.reason.slice(0, 500) : "";
  if (!projectId || !ledgerId || !new Set(["MATCHED","REJECTED"]).has(decision)) {
    return json({ error: "INVALID_RECONCILIATION_REQUEST" }, 400);
  }
  if (decision === "MATCHED" && !paymentOrderId) {
    return json({ error: "PAYMENT_ORDER_REQUIRED_FOR_SETTLEMENT" }, 400);
  }

  const project = await env.DB.prepare(
    "SELECT project_id,state,policy_status FROM project_requests WHERE project_id=? LIMIT 1"
  ).bind(projectId).first();
  if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);

  const ledger = await env.DB.prepare(
    "SELECT l.ledger_id,l.project_id,l.ledger_state,l.provider_event_id,l.amount_usd,l.currency_code,e.verification_status,e.event_type FROM payment_ledger l JOIN payment_events e ON e.provider_event_id=l.provider_event_id WHERE l.ledger_id=? LIMIT 1"
  ).bind(ledgerId).first();
  if (!ledger) return json({ error: "PAYMENT_LEDGER_NOT_FOUND" }, 404);
  if (ledger.verification_status !== "VERIFIED") return json({ error: "PAYMENT_EVENT_NOT_VERIFIED" }, 409);

  if (ledger.ledger_state === "MATCHED") {
    if (decision === "MATCHED" && ledger.project_id === projectId) {
      const settlement = await env.DB.prepare(
        "SELECT settlement_id,payment_order_id FROM sales_settlements WHERE ledger_id=? LIMIT 1"
      ).bind(ledgerId).first();
      if (settlement?.payment_order_id === paymentOrderId) {
        return json({
          settlement_id:settlement.settlement_id,
          ledger_id:ledgerId,
          payment_order_id:paymentOrderId,
          project_id:projectId,
          ledger_state:"MATCHED",
          project_state:"PAID",
          replayed:true,
        }, 200);
      }
    }
    return json({ error: "PAYMENT_LEDGER_ALREADY_MATCHED" }, 409);
  }
  if (ledger.ledger_state === "REJECTED") {
    return json({ error: "PAYMENT_LEDGER_TERMINAL" }, 409);
  }

  if (decision === "REJECTED") {
    const now = new Date().toISOString();
    const approvalId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(INSERT_APPROVAL_SQL).bind(
        approvalId,projectId,"payment_reconciliation","DENIED","admin",reason,
        JSON.stringify({ ledger_id:ledgerId, provider_event_id:ledger.provider_event_id, source:"approval_console" }),now,
      ),
      env.DB.prepare(
        "UPDATE payment_ledger SET project_id=?,ledger_state='REJECTED',notes=?,updated_at=? WHERE ledger_id=?"
      ).bind(projectId,reason,now,ledgerId),
    ]);
    return json({
      reconciliation_approval_id:approvalId,
      ledger_id:ledgerId,
      project_id:projectId,
      ledger_state:"REJECTED",
      replayed:false,
    }, 200);
  }

  if (ledger.ledger_state !== "REQUIRES_HUMAN") {
    return json({ error: "PAYMENT_LEDGER_NOT_SETTLEABLE" }, 409);
  }
  if (!new Set(["PAYMENT.CAPTURE.COMPLETED","PAYMENT.SALE.COMPLETED"]).has(ledger.event_type)) {
    return json({ error: "PAYMENT_EVENT_NOT_COMPLETED" }, 409);
  }

  const paymentOrder = await env.DB.prepare(
    "SELECT po.payment_order_id,po.quote_id,po.project_id,po.status,po.amount_minor,po.currency_code,q.status AS quote_status FROM payment_orders po JOIN quotes q ON q.quote_id=po.quote_id WHERE po.payment_order_id=? LIMIT 1"
  ).bind(paymentOrderId).first();
  if (!paymentOrder) return json({ error: "PAYMENT_ORDER_NOT_FOUND" }, 404);
  if (paymentOrder.project_id !== projectId) return json({ error: "PAYMENT_ORDER_PROJECT_MISMATCH" }, 409);
  if (paymentOrder.status !== "PENDING" || paymentOrder.quote_status !== "ACCEPTED") {
    return json({ error: "PAYMENT_ORDER_NOT_SETTLEABLE" }, 409);
  }
  if (project.policy_status !== "ALLOWED" || project.state !== "PAYMENT_PENDING") {
    return json({ error: "PROJECT_NOT_READY_FOR_SETTLEMENT" }, 409);
  }

  let providerAmountMinor;
  try { providerAmountMinor = providerAmountToMinor(ledger.amount_usd); }
  catch (error) { return json({ error: String(error.message) }, 409); }
  const ledgerCurrency = String(ledger.currency_code || "").toUpperCase();
  if (providerAmountMinor !== Number(paymentOrder.amount_minor) || ledgerCurrency !== paymentOrder.currency_code) {
    return json({ error: "PAYMENT_ORDER_AMOUNT_OR_CURRENCY_MISMATCH" }, 409);
  }

  const now = new Date().toISOString();
  const approvalId = crypto.randomUUID();
  const settlementId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(INSERT_APPROVAL_SQL).bind(
      approvalId,projectId,"payment_reconciliation","APPROVED","admin",reason,
      JSON.stringify({
        ledger_id:ledgerId,
        payment_order_id:paymentOrderId,
        quote_id:paymentOrder.quote_id,
        provider_event_id:ledger.provider_event_id,
        source:"approval_console"
      }),now,
    ),
    env.DB.prepare(
      "UPDATE payment_ledger SET project_id=?,ledger_state='MATCHED',notes=?,updated_at=? WHERE ledger_id=? AND ledger_state='REQUIRES_HUMAN'"
    ).bind(projectId,reason,now,ledgerId),
    env.DB.prepare(
      "UPDATE payment_orders SET status='COMPLETED',updated_at=? WHERE payment_order_id=? AND status='PENDING'"
    ).bind(now,paymentOrderId),
    env.DB.prepare(
      "INSERT INTO sales_settlements (settlement_id,payment_order_id,ledger_id,provider_event_id,amount_minor,currency_code,status,created_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(settlementId,paymentOrderId,ledgerId,ledger.provider_event_id,providerAmountMinor,ledgerCurrency,"MATCHED",now),
    env.DB.prepare(
      "UPDATE project_requests SET state='PAID',updated_at=? WHERE project_id=? AND state='PAYMENT_PENDING'"
    ).bind(now,projectId),
  ]);
  return json({
    reconciliation_approval_id:approvalId,
    settlement_id:settlementId,
    ledger_id:ledgerId,
    payment_order_id:paymentOrderId,
    quote_id:paymentOrder.quote_id,
    project_id:projectId,
    ledger_state:"MATCHED",
    project_state:"PAID",
    replayed:false,
  }, 200);
}

export async function handleRevenueAgentOpportunities(request, env) {
  if (!revenueAgentConfigured(env)) return json({ error: "REVENUE_AGENT_NOT_CONFIGURED" }, 503);
  if (!await requireRevenueAgent(request, env)) return json({ error: "UNAUTHORIZED" }, 401, { "www-authenticate": "Bearer" });
  if (request.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "50");
    const feed = await loadApprovedOpportunityFeed(env.DB, limit);
    return json({
      ...feed,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("revenue_agent_opportunity_feed_failed", { error: String(error?.name || "Error") });
    return json({ error: "REVENUE_AGENT_FEED_UNAVAILABLE" }, 503);
  }
}

export async function handleRevenueRuntimeAuthorization(request, env) {
  if (!revenueAgentConfigured(env)) return json({ error: "REVENUE_AGENT_NOT_CONFIGURED" }, 503);
  if (!await requireRevenueAgent(request, env)) return json({ error: "UNAUTHORIZED" }, 401, { "www-authenticate": "Bearer" });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!env.REVENUE_RUNTIME_HMAC_KEY) return json({ error: "REVENUE_RUNTIME_SIGNING_NOT_CONFIGURED" }, 503);

  let input;
  try {
    input = await readJsonWithLimit(request);
    const envelope = await buildRevenueRuntimeAuthorization(
      env.DB,
      input,
      env.REVENUE_RUNTIME_HMAC_KEY,
    );
    return json({
      authorization: envelope,
      authority: "PREPARE_ONLY",
      generated_at: new Date().toISOString(),
    }, 201);
  } catch (error) {
    const code = String(error?.message || "REVENUE_AUTHORIZATION_FAILED");
    const denied = new Set([
      "PROJECT_POLICY_NOT_ALLOWED",
      "APPROVAL_EVIDENCE_MISSING",
      "MATCHED_PAYMENT_OR_ESCROW_REQUIRED",
    ]);
    const invalid = code.startsWith("INVALID_");
    const status = denied.has(code) ? 409 : invalid ? 400 : code === "REVENUE_RUNTIME_HMAC_KEY_NOT_CONFIGURED" ? 503 : 400;
    return json({ error: code }, status);
  }
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
    if (url.pathname === "/api/v1/admin/quotes") {
      return handleAdminQuoteCreate(request, env);
    }
    if (url.pathname === "/api/v1/admin/quotes/accept") {
      return handleAdminQuoteAcceptance(request, env);
    }
    if (url.pathname === "/api/v1/admin/payment-orders") {
      return handleAdminPaymentOrderCreate(request, env);
    }
    if (url.pathname === "/api/v1/admin/payments/reconcile") {
      return handleAdminPaymentReconciliation(request, env);
    }
    if (url.pathname === "/api/v1/revenue-agent/opportunities") {
      return handleRevenueAgentOpportunities(request, env);
    }
    if (url.pathname === "/api/v1/revenue-agent/authorization") {
      return handleRevenueRuntimeAuthorization(request, env);
    }
    if (url.pathname === "/api/v1/admin/revenue-intelligence") {
      return handleAdminRevenueIntelligence(request, env);
    }
    return json({ error: "NOT_FOUND" }, 404);
  },
  async scheduled(_controller, env) {
    await dispatchOutbox(env);
  },
};
