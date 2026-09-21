import test from "node:test";
import assert from "node:assert/strict";
import { buildRevenueRecommendation, safeRate } from "./revenue-decision-engine.mjs";

test("safeRate fails closed on invalid inputs and avoids divide by zero", () => {
  assert.equal(safeRate(1, 0), null);
  assert.throws(() => safeRate(-1, 2), /INVALID_NUMERATOR/);
  assert.throws(() => safeRate(1, "not-a-number"), /INVALID_DENOMINATOR/);
});

test("recommendations never grant external authority", () => {
  const result = buildRevenueRecommendation({
    landing_sessions:100,
    generated_leads:5,
    total_requests:5,
    pending_policy_reviews:2,
    qualified_leads:1,
    converted_customers:0,
    reconciled_usd_revenue:0
  }, { lead_propensity_mean:0.4, anomaly_score:0.2 });
  assert.equal(result.mode, "RECOMMEND_ONLY");
  assert.equal(result.external_side_effects_authorized, false);
  assert.equal(result.paid_spend_authorized, false);
  assert.equal(result.publication_authorized, false);
  assert.equal(result.financial_execution_authorized, false);
  assert.equal(result.proposals.some((p) => p.id === "review-pending-policy"), true);
});

test("model signals are bounded evidence, not authority", () => {
  assert.throws(() => buildRevenueRecommendation({}, { anomaly_score:1.2 }), /INVALID_MODEL_SIGNAL_ANOMALY_SCORE/);
  const result = buildRevenueRecommendation({}, { anomaly_score:0.99 });
  assert.equal(result.proposals.some((p) => p.id === "investigate-model-anomaly"), true);
  assert.equal(result.authority, "NO_EXTERNAL_SIDE_EFFECTS");
});

test("converted customers without reconciled USD revenue triggers human reconciliation", () => {
  const result = buildRevenueRecommendation({
    converted_customers:2,
    reconciled_usd_revenue:0
  });
  const proposal = result.proposals.find((p) => p.id === "reconcile-conversion-revenue");
  assert.equal(proposal.requires_human, true);
  assert.equal(proposal.external_side_effect, false);
});
