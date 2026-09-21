import test from "node:test";
import assert from "node:assert/strict";
import {promotionDecision,authorizeAgentAction} from "../src/model-governance.mjs";

const evidence={
 model_id:"lead-v1",training_cutoff:"2026-07-31T00:00:00Z",evaluation_start:"2026-08-01T00:00:00Z",
 evaluation_end:"2026-08-31T23:59:59Z",dataset_sha256:"a".repeat(64),code_sha:"deadbeef",
 metrics:{pr_auc:.72,brier:.16,calibration_error:.04},shadow_observations:250,external_side_effects:0
};

test("model remains NO_GO without explicit human approval",()=>{
 const r=promotionDecision(evidence,{adversarial_eval_pass:true,drift_rollback_pass:true,finops_budget_pass:true});
 assert.equal(r.decision,"NO_GO"); assert.ok(r.blockers.includes("HUMAN_APPROVAL_REQUIRED"));
});
test("temporal leakage is rejected",()=>{
 assert.throws(()=>promotionDecision({...evidence,training_cutoff:"2026-08-02T00:00:00Z"},{}),/TEMPORAL_LEAKAGE_RISK/);
});
test("shadow mode rejects side effects",()=>{
 const r=promotionDecision({...evidence,external_side_effects:1},{adversarial_eval_pass:true,drift_rollback_pass:true,finops_budget_pass:true,human_production_approval:true});
 assert.ok(r.blockers.includes("SHADOW_SIDE_EFFECT_VIOLATION"));
});
test("probabilistic output never authorizes a critical action",()=>{
 assert.equal(authorizeAgentAction({kind:"PAYMENT",model_only:true,policy_allowed:true,human_approval:true}).allowed,false);
});
test("critical action requires human approval",()=>{
 assert.equal(authorizeAgentAction({kind:"PUBLICATION",policy_allowed:true}).reason,"HUMAN_APPROVAL_REQUIRED");
});
test("kill switch wins after approval",()=>{
 assert.equal(authorizeAgentAction({kind:"PUBLICATION",policy_allowed:true,human_approval:true,kill_switch:true}).reason,"KILL_SWITCH_ACTIVE");
});
