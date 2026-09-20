import { buildRevenueRecommendation } from "../../scripts/revenue-decision-engine.mjs";

async function scalar(db, sql, fallback = 0) {
  const row = await db.prepare(sql).first();
  const value = Number(row?.value ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export async function loadRevenueAggregate(db) {
  const [
    totalRequests,
    pendingPolicyReviews,
    qualifiedLeads,
    convertedCustomers,
    reconciledUsdRevenue,
  ] = await Promise.all([
    scalar(db, "SELECT COUNT(*) AS value FROM project_requests"),
    scalar(db, "SELECT COUNT(*) AS value FROM project_requests WHERE policy_status IN ('PENDING','REQUIRES_HUMAN')"),
    scalar(db, "SELECT COUNT(DISTINCT project_id) AS value FROM lead_lifecycle_events WHERE stage='qualify_lead'"),
    scalar(db, "SELECT COUNT(DISTINCT project_id) AS value FROM lead_lifecycle_events WHERE stage='close_convert_lead'"),
    scalar(db, "SELECT COALESCE(SUM(CASE WHEN currency_code='USD' AND ledger_state='MATCHED' THEN CAST(amount_usd AS REAL) ELSE 0 END),0) AS value FROM payment_ledger"),
  ]);

  return {
    source:"commercial_d1",
    total_requests:totalRequests,
    pending_policy_reviews:pendingPolicyReviews,
    qualified_leads:qualifiedLeads,
    converted_customers:convertedCustomers,
    reconciled_usd_revenue:reconciledUsdRevenue,
    landing_sessions:0,
    generated_leads:0,
    analytics_note:"GA4 funnel metrics are intentionally not inferred from the commercial ledger."
  };
}

export async function buildRuntimeRevenueView(db) {
  const summary = await loadRevenueAggregate(db);
  return {
    summary,
    recommendation:buildRevenueRecommendation(summary),
    evidence_state:{
      ml_models:"NOT_ACTIVATED",
      llm_agent:"NOT_ACTIVATED",
      multimodal_agent:"NOT_ACTIVATED",
      external_actions:"HUMAN_GATED"
    }
  };
}
