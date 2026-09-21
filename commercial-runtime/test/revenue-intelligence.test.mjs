import test from "node:test";
import assert from "node:assert/strict";
import { buildRuntimeRevenueView, loadRevenueAggregate } from "../src/revenue-intelligence.mjs";

function fakeDb(values) {
  let index = 0;
  return {
    prepare() {
      return {
        first: async () => ({ value: values[index++] ?? 0 })
      };
    }
  };
}

test("runtime aggregate stays aggregate-only and does not infer GA4 metrics", async () => {
  const summary = await loadRevenueAggregate(fakeDb([7,2,1,1,900]));
  assert.equal(summary.total_requests, 7);
  assert.equal(summary.pending_policy_reviews, 2);
  assert.equal(summary.qualified_leads, 1);
  assert.equal(summary.converted_customers, 1);
  assert.equal(summary.settled_cash_usd, 900);
  assert.equal(summary.reconciled_usd_revenue, 900);
  assert.equal(summary.revenue_recognition, "SETTLED_CASH_ONLY");
  assert.equal(summary.landing_sessions, 0);
  assert.equal(summary.generated_leads, 0);
});

test("runtime view remains recommend-only with all advanced model paths disabled", async () => {
  const view = await buildRuntimeRevenueView(fakeDb([3,1,0,0,0]));
  assert.equal(view.recommendation.authority, "NO_EXTERNAL_SIDE_EFFECTS");
  assert.equal(view.evidence_state.ml_models, "RESEARCH_GATED");
  assert.equal(view.evidence_state.llm_agent, "SHADOW_GATED");
  assert.equal(view.evidence_state.multimodal_agent, "SHADOW_GATED");
  assert.equal(view.evidence_state.external_actions, "HUMAN_GATED");
});
