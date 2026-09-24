function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

export function normalizeApprovedOpportunity(row = {}) {
  const projectId = typeof row.project_id === "string" ? row.project_id : "";
  const policyStatus = typeof row.policy_status === "string" ? row.policy_status : "";
  const state = typeof row.state === "string" ? row.state : "";
  if (!projectId || policyStatus !== "ALLOWED") return null;

  return {
    schema:"jadel.revenue.opportunity.v1",
    opportunity_id:projectId,
    source:"owned_site",
    service_ids:safeJsonArray(row.service_ids_json),
    intake_state:state,
    policy_status:policyStatus,
    created_at:typeof row.created_at === "string" ? row.created_at : null,
    updated_at:typeof row.updated_at === "string" ? row.updated_at : null,
    authority:{
      mode:"RESEARCH_SCORE_DRAFT_ONLY",
      external_submission_authorized:false,
      contract_acceptance_authorized:false,
      deployment_authorized:false,
      financial_execution_authorized:false
    },
    pii_included:false
  };
}

export async function loadApprovedOpportunityFeed(db, limit = 50) {
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const result = await db.prepare(
    "SELECT project_id,service_ids_json,state,policy_status,created_at,updated_at FROM project_requests WHERE policy_status='ALLOWED' ORDER BY updated_at DESC LIMIT ?"
  ).bind(boundedLimit).all();

  const opportunities = (result.results || [])
    .map(normalizeApprovedOpportunity)
    .filter(Boolean);

  return {
    schema:"jadel.revenue.opportunity-feed.v1",
    authority:"RESEARCH_SCORE_DRAFT_ONLY",
    production_execution_authorized:false,
    pii_included:false,
    count:opportunities.length,
    opportunities
  };
}
