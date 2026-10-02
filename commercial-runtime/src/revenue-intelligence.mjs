const finiteNonNegative = (value, name) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error(`INVALID_${name.toUpperCase()}`);
  return numeric;
};

const boundedSignal = (value, name) => {
  if (value === undefined || value === null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) throw new Error(`INVALID_MODEL_SIGNAL_${name.toUpperCase()}`);
  return numeric;
};

export function safeRate(numerator, denominator) {
  const n = finiteNonNegative(numerator, "numerator");
  const d = finiteNonNegative(denominator, "denominator");
  return d === 0 ? null : n / d;
}

export function buildRevenueRecommendation(summary = {}, modelSignals = {}) {
  const metrics = {
    landing_sessions: finiteNonNegative(summary.landing_sessions, "landing_sessions"),
    generated_leads: finiteNonNegative(summary.generated_leads, "generated_leads"),
    total_requests: finiteNonNegative(summary.total_requests, "total_requests"),
    pending_policy_reviews: finiteNonNegative(summary.pending_policy_reviews, "pending_policy_reviews"),
    qualified_leads: finiteNonNegative(summary.qualified_leads, "qualified_leads"),
    converted_customers: finiteNonNegative(summary.converted_customers, "converted_customers"),
    reconciled_usd_revenue: finiteNonNegative(summary.reconciled_usd_revenue, "reconciled_usd_revenue"),
  };

  const signals = {
    lead_propensity_mean: boundedSignal(modelSignals.lead_propensity_mean, "lead_propensity_mean"),
    anomaly_score: boundedSignal(modelSignals.anomaly_score, "anomaly_score"),
  };

  const rates = {
    landing_to_lead: safeRate(metrics.generated_leads, metrics.landing_sessions),
    lead_to_qualified: safeRate(metrics.qualified_leads, metrics.generated_leads),
    qualified_to_customer: safeRate(metrics.converted_customers, metrics.qualified_leads),
  };

  const proposals = [];
  if (metrics.pending_policy_reviews > 0) {
    proposals.push({
      id:"review-pending-policy", priority:"HIGH",
      action:"Review pending policy decisions in the governed approval queue.",
      scope:"INTERNAL_REVIEW", external_side_effect:false, requires_human:false
    });
  }
  if (metrics.landing_sessions > 0 && metrics.generated_leads === 0) {
    proposals.push({
      id:"inspect-zero-lead-funnel", priority:"MEDIUM",
      action:"Inspect analytics integrity, CTA behavior and intake completion before changing acquisition spend.",
      scope:"ANALYSIS", external_side_effect:false, requires_human:false
    });
  }
  if (signals.anomaly_score !== null && signals.anomaly_score >= 0.8) {
    proposals.push({
      id:"investigate-model-anomaly", priority:"HIGH",
      action:"Investigate the anomalous aggregate signal; do not automate a commercial action from the score alone.",
      scope:"MODEL_REVIEW", external_side_effect:false, requires_human:false
    });
  }
  if (metrics.converted_customers > 0 && metrics.reconciled_usd_revenue === 0) {
    proposals.push({
      id:"reconcile-conversion-revenue", priority:"HIGH",
      action:"Reconcile converted-customer evidence against the payment ledger before reporting revenue.",
      scope:"FINANCIAL_RECONCILIATION", external_side_effect:false, requires_human:true
    });
  }
  if (proposals.length === 0) {
    proposals.push({
      id:"collect-more-evidence", priority:"LOW",
      action:"Continue collecting governed funnel and outcome evidence; no autonomous optimization is justified yet.",
      scope:"OBSERVATION", external_side_effect:false, requires_human:false
    });
  }

  return {
    schema:"jadel.revenue.recommendation.v1",
    mode:"RECOMMEND_ONLY",
    authority:"NO_EXTERNAL_SIDE_EFFECTS",
    external_side_effects_authorized:false,
    paid_spend_authorized:false,
    publication_authorized:false,
    financial_execution_authorized:false,
    metrics, rates, model_signals:signals, proposals
  };
}

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

export async function loadOfferPerformance(db) {
  const rows = await db.prepare(
    `SELECT
       p.offer_id AS offer_id,
       COUNT(DISTINCT p.project_id) AS total_requests,
       COUNT(DISTINCT CASE WHEN p.policy_status='ALLOWED' THEN p.project_id END) AS allowed_projects,
       COUNT(DISTINCT CASE WHEN l.ledger_state='MATCHED' THEN p.project_id END) AS paid_projects,
       COALESCE(SUM(CASE WHEN l.ledger_state='MATCHED' AND l.currency_code='USD'
                         THEN CAST(l.amount_usd AS REAL) ELSE 0 END),0) AS reconciled_usd_revenue
     FROM project_requests p
     LEFT JOIN payment_ledger l ON l.project_id=p.project_id
     WHERE p.offer_id <> ''
     GROUP BY p.offer_id
     ORDER BY reconciled_usd_revenue DESC, total_requests DESC, p.offer_id ASC`
  ).all();
  return (rows.results || []).map((row) => ({
    offer_id:String(row.offer_id || ""),
    total_requests:finiteNonNegative(row.total_requests, "offer_total_requests"),
    allowed_projects:finiteNonNegative(row.allowed_projects, "offer_allowed_projects"),
    paid_projects:finiteNonNegative(row.paid_projects, "offer_paid_projects"),
    reconciled_usd_revenue:finiteNonNegative(
      row.reconciled_usd_revenue,
      "offer_reconciled_usd_revenue",
    ),
  }));
}

export async function buildRuntimeRevenueView(db) {
  const [summary, offerPerformance] = await Promise.all([
    loadRevenueAggregate(db),
    loadOfferPerformance(db),
  ]);
  return {
    summary,
    offer_performance:offerPerformance,
    recommendation:buildRevenueRecommendation(summary),
    evidence_state:{
      ml_models:"NOT_ACTIVATED",
      llm_agent:"NOT_ACTIVATED",
      multimodal_agent:"NOT_ACTIVATED",
      external_actions:"HUMAN_GATED"
    }
  };
}
