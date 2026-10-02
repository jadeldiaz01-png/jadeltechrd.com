import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimeRevenueView,
  loadOfferPerformance,
  loadRevenueAggregate,
} from "../src/revenue-intelligence.mjs";

function fakeDb(values, rows = []) {
  let index = 0;
  return {
    prepare() {
      return {
        first: async () => ({ value: values[index++] ?? 0 }),
        all: async () => ({ results: rows }),
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
  assert.equal(summary.reconciled_usd_revenue, 900);
  assert.equal(summary.landing_sessions, 0);
  assert.equal(summary.generated_leads, 0);
});

test("runtime view remains recommend-only with all advanced model paths disabled", async () => {
  const view = await buildRuntimeRevenueView(fakeDb([3,1,0,0,0]));
  assert.equal(view.recommendation.authority, "NO_EXTERNAL_SIDE_EFFECTS");
  assert.equal(view.evidence_state.ml_models, "NOT_ACTIVATED");
  assert.equal(view.evidence_state.llm_agent, "NOT_ACTIVATED");
  assert.equal(view.evidence_state.multimodal_agent, "NOT_ACTIVATED");
  assert.equal(view.evidence_state.external_actions, "HUMAN_GATED");
});


test("offer performance is ledger-backed and contains no inferred revenue", async () => {
  const db = fakeDb([], [{
    offer_id:"automation_blueprint",
    total_requests:4,
    allowed_projects:2,
    paid_projects:1,
    reconciled_usd_revenue:250,
  }]);
  const rows = await loadOfferPerformance(db);
  assert.deepEqual(rows, [{
    offer_id:"automation_blueprint",
    total_requests:4,
    allowed_projects:2,
    paid_projects:1,
    reconciled_usd_revenue:250,
  }]);
});

test("runtime view exposes offer performance separately from aggregate recommendation", async () => {
  const view = await buildRuntimeRevenueView(fakeDb(
    [5,1,2,1,250],
    [{
      offer_id:"automation_blueprint",
      total_requests:3,
      allowed_projects:2,
      paid_projects:1,
      reconciled_usd_revenue:250,
    }],
  ));
  assert.equal(view.offer_performance.length, 1);
  assert.equal(view.offer_performance[0].offer_id, "automation_blueprint");
  assert.equal(view.offer_performance[0].reconciled_usd_revenue, 250);
  assert.equal(view.recommendation.financial_execution_authorized, false);
});
