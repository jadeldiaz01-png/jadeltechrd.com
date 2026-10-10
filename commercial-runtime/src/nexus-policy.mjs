// Private, fail-closed Nexus policy boundary. No public HTTP or payment authority.
const POLICY_URL = "https://nexus.internal/v1/project-readiness";
const DECISIONS = new Set(["ALLOW", "DENY", "REQUIRES_HUMAN"]);
const EVIDENCE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function safeHuman(reason) {
  return { decision: "REQUIRES_HUMAN", reason, evidence_id: null, fail_closed: true };
}

export async function evaluateNexusPolicy(env, project) {
  if (!env?.NEXUS_POLICY || typeof env.NEXUS_POLICY.fetch !== "function") {
    return safeHuman("NEXUS_POLICY_BINDING_MISSING");
  }

  let response;
  try {
    response = await env.NEXUS_POLICY.fetch(new Request(POLICY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.project_id,
        service_ids: JSON.parse(project.service_ids_json),
        requested_transition: "POLICY_ALLOWED",
      }),
    }));
  } catch {
    return safeHuman("NEXUS_POLICY_FETCH_FAILED");
  }

  if (!response || !response.ok) {
    const code = Number.isInteger(response?.status) ? response.status : 0;
    return safeHuman("NEXUS_HTTP_" + code);
  }

  let result;
  try {
    const body = await response.text();
    if (body.length > 8192) return safeHuman("NEXUS_RESPONSE_TOO_LARGE");
    result = JSON.parse(body);
  } catch {
    return safeHuman("INVALID_NEXUS_RESPONSE");
  }

  if (!DECISIONS.has(result?.decision)) return safeHuman("INVALID_NEXUS_DECISION");
  const evidenceId = typeof result.evidence_id === "string" && EVIDENCE_ID.test(result.evidence_id)
    ? result.evidence_id : null;
  if (result.decision === "ALLOW" && !evidenceId) {
    return safeHuman("NEXUS_ALLOW_EVIDENCE_MISSING");
  }
  const reason = typeof result.reason === "string"
    ? result.reason.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500)
    : "unspecified";
  return {
    decision: result.decision,
    reason,
    evidence_id: evidenceId,
    fail_closed: result.decision !== "ALLOW",
  };
}

export async function persistNexusPolicyDecision(env, projectId, policy, state, policyStatus) {
  if (!DECISIONS.has(policy?.decision)) throw new Error("INVALID_POLICY_EVIDENCE");
  const now = new Date().toISOString();
  // Stable event id ensures a Workflow step replay does not duplicate the ledger entry.
  const eventId = "nexus-policy:" + projectId;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO evidence_events (event_id,project_id,event_type,state,correlation_id,payload_json,created_at) VALUES (?,?,?,?,?,?,?)"
    ).bind(
      eventId, projectId, "NEXUS_POLICY_EVALUATED", state, "project-" + projectId,
      JSON.stringify({
        decision: policy.decision,
        reason: policy.reason,
        evidence_id: policy.evidence_id || null,
        fail_closed: policy.fail_closed === true,
        contract_version: "nexus-policy-v1",
      }), now
    ),
    env.DB.prepare(
      "UPDATE project_requests SET state=?,policy_status=?,updated_at=? WHERE project_id=? AND state IN ('VALIDATED','POLICY_CHECK')"
    ).bind(state, policyStatus, now, projectId),
  ]);
}
