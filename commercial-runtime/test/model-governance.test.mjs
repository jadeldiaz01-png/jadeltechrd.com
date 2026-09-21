import test from "node:test";
import assert from "node:assert/strict";
import {promotionDecision,authorizeAgentAction} from "../src/model-governance.mjs";

const evidence={
  model_id:"lead-v1",
  model_kind:"LOGISTIC_REGRESSION",
  training_cutoff:"2026-07-31T00:00:00Z",
  evaluation_start:"2026-08-01T00:00:00Z",
  evaluation_end:"2026-08-31T23:59:59Z",
  dataset_sha256:"a".repeat(64),
  code_sha:"b".repeat(40),
  metrics:{pr_auc:.72,baseline_pr_auc:.60,brier:.16,calibration_error:.04},
  labeled_samples:800,
  positive_labels:120,
  shadow_observations:250,
  external_side_effects:0
};

const policy={
  point_in_time_lineage_pass:true,
  leakage_test_pass:true,
  slice_analysis_pass:true,
  independent_reproduction_pass:true,
  adversarial_eval_pass:true,
  drift_rollback_pass:true,
  finops_budget_pass:true
};

test("model remains NO_GO without explicit human approval",()=>{
  const r=promotionDecision(evidence,policy);
  assert.equal(r.decision,"NO_GO");
  assert.ok(r.blockers.includes("HUMAN_APPROVAL_REQUIRED"));
});

test("temporal leakage is rejected",()=>{
  assert.throws(()=>promotionDecision({...evidence,training_cutoff:"2026-08-02T00:00:00Z"},policy),/TEMPORAL_LEAKAGE_RISK/);
});

test("dataset and code lineage must be immutable hashes",()=>{
  assert.throws(()=>promotionDecision({...evidence,code_sha:"deadbeef"},policy),/INVALID_CODE_SHA/);
  assert.throws(()=>promotionDecision({...evidence,dataset_sha256:"bad"},policy),/INVALID_DATASET_SHA256/);
});

test("baseline lift, sample volume and calibration are independent gates",()=>{
  const r=promotionDecision({
    ...evidence,
    labeled_samples:20,
    positive_labels:2,
    metrics:{...evidence.metrics,pr_auc:.605,calibration_error:.2}
  },policy);
  assert.ok(r.blockers.includes("INSUFFICIENT_LABELED_SAMPLES"));
  assert.ok(r.blockers.includes("INSUFFICIENT_POSITIVE_LABELS"));
  assert.ok(r.blockers.includes("BASELINE_LIFT_GATE_FAILED"));
  assert.ok(r.blockers.includes("CALIBRATION_GATE_FAILED"));
});

test("shadow mode rejects side effects",()=>{
  const r=promotionDecision({...evidence,external_side_effects:1},{...policy,human_production_approval:true});
  assert.ok(r.blockers.includes("SHADOW_SIDE_EFFECT_VIOLATION"));
});

test("DNN is rejected unless data volume, incremental value and reproducibility pass",()=>{
  const r=promotionDecision({...evidence,model_kind:"DNN_CLASSIFIER"},{...policy,human_production_approval:true});
  assert.ok(r.blockers.includes("DNN_DATA_VOLUME_GATE_FAILED"));
  assert.ok(r.blockers.includes("DNN_INCREMENTAL_VALUE_NOT_PASS"));
  assert.ok(r.blockers.includes("DNN_REPRODUCIBILITY_NOT_PASS"));
});

test("probabilistic output never authorizes a critical action",()=>{
  assert.equal(authorizeAgentAction({kind:"PAYMENT",model_only:true,policy_allowed:true,human_approval:true}).allowed,false);
});

test("critical action requires human approval",()=>{
  assert.equal(authorizeAgentAction({kind:"PUBLICATION",policy_allowed:true}).reason,"HUMAN_APPROVAL_REQUIRED");
  assert.equal(authorizeAgentAction({kind:"SETTLEMENT_RECORD",policy_allowed:true}).reason,"HUMAN_APPROVAL_REQUIRED");
});

test("kill switch wins even after approval",()=>{
  assert.equal(authorizeAgentAction({kind:"PUBLICATION",policy_allowed:true,human_approval:true,kill_switch:true}).reason,"KILL_SWITCH_ACTIVE");
});

test("noncritical internal action still requires deterministic policy",()=>{
  assert.equal(authorizeAgentAction({kind:"INTERNAL_RECOMMENDATION",policy_allowed:false}).reason,"POLICY_DENIED");
  assert.equal(authorizeAgentAction({kind:"INTERNAL_RECOMMENDATION",policy_allowed:true}).allowed,true);
});
