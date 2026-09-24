const ACTIONS = new Set(["prepare_deliverable", "run_approved_analysis"]);
const ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

function requireId(value, name) {
  const text = String(value || "");
  if (!ID_RE.test(text)) throw new Error(`INVALID_${name.toUpperCase()}`);
  return text;
}

function requireSigningKey(secret) {
  const value = String(secret || "");
  if (new TextEncoder().encode(value).byteLength < 32) {
    throw new Error("REVENUE_RUNTIME_HMAC_KEY_NOT_CONFIGURED");
  }
  return value;
}

export function canonicalRevenueAuthorization(envelope) {
  return [
    envelope.schema_version,
    envelope.project,
    envelope.opportunity_id,
    envelope.approval_id,
    envelope.payment_or_escrow_evidence_id,
    envelope.action,
    envelope.request_id,
    String(envelope.issued_at),
    String(envelope.expires_at),
    String(envelope.financial_action),
    String(envelope.publication),
    String(envelope.contract_acceptance),
    String(envelope.production_deploy),
  ].join("\n");
}

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireSigningKey(secret)),
    { name:"HMAC", hash:"SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildRevenueRuntimeAuthorization(db, input, signingSecret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const projectId = requireId(input.project_id, "project_id");
  const ledgerId = requireId(input.ledger_id, "ledger_id");
  const requestId = requireId(input.request_id, "request_id");
  const action = String(input.action || "");
  if (!ACTIONS.has(action)) throw new Error("INVALID_ACTION");

  const project = await db.prepare(
    "SELECT project_id,policy_status FROM project_requests WHERE project_id=? AND policy_status='ALLOWED' LIMIT 1"
  ).bind(projectId).first();
  if (!project) throw new Error("PROJECT_POLICY_NOT_ALLOWED");

  const approval = await db.prepare(
    "SELECT approval_id FROM approval_events WHERE project_id=? AND approval_type='policy' AND decision='APPROVED' ORDER BY created_at DESC LIMIT 1"
  ).bind(projectId).first();
  if (!approval?.approval_id) throw new Error("APPROVAL_EVIDENCE_MISSING");

  const ledger = await db.prepare(
    "SELECT ledger_id FROM payment_ledger WHERE ledger_id=? AND project_id=? AND ledger_state='MATCHED' LIMIT 1"
  ).bind(ledgerId, projectId).first();
  if (!ledger?.ledger_id) throw new Error("MATCHED_PAYMENT_OR_ESCROW_REQUIRED");

  const issuedAt = Number(nowSeconds);
  if (!Number.isInteger(issuedAt) || issuedAt <= 0) throw new Error("INVALID_ISSUED_AT");
  const envelope = {
    schema_version:"1.0",
    project:"ai-income-revenue-engine",
    opportunity_id:projectId,
    approval_id:String(approval.approval_id),
    payment_or_escrow_evidence_id:String(ledger.ledger_id),
    action,
    request_id:requestId,
    issued_at:issuedAt,
    expires_at:issuedAt + 300,
    financial_action:false,
    publication:false,
    contract_acceptance:false,
    production_deploy:false,
  };
  return {
    ...envelope,
    authorization_signature:await hmacSha256Hex(
      signingSecret,
      canonicalRevenueAuthorization(envelope),
    ),
  };
}
