const finite01=(v,n)=>{const x=Number(v);if(!Number.isFinite(x)||x<0||x>1)throw new Error("INVALID_"+n.toUpperCase());return x;};

export function validateModelEvidence(e={}){
  const required=["model_id","training_cutoff","evaluation_start","evaluation_end","dataset_sha256","code_sha","metrics"];
  for(const k of required) if(!e[k]) throw new Error("MISSING_"+k.toUpperCase());
  if(new Date(e.training_cutoff)>=new Date(e.evaluation_start)) throw new Error("TEMPORAL_LEAKAGE_RISK");
  if(!/^[a-f0-9]{64}$/i.test(e.dataset_sha256)) throw new Error("INVALID_DATASET_SHA256");
  return {
    model_id:String(e.model_id),
    dataset_sha256:e.dataset_sha256.toLowerCase(),
    code_sha:String(e.code_sha),
    pr_auc:finite01(e.metrics.pr_auc,"pr_auc"),
    brier:finite01(e.metrics.brier,"brier"),
    calibration_error:finite01(e.metrics.calibration_error,"calibration_error"),
    shadow_observations:Number(e.shadow_observations||0),
    external_side_effects:Number(e.external_side_effects||0)
  };
}

export function promotionDecision(e={},policy={}){
  const x=validateModelEvidence(e);
  const minShadow=Number(policy.min_shadow_observations??100);
  const maxCalibration=Number(policy.max_calibration_error??0.10);
  const minPrAuc=Number(policy.min_pr_auc??0.50);
  const blockers=[];
  if(x.pr_auc<minPrAuc) blockers.push("PR_AUC_BELOW_GATE");
  if(x.calibration_error>maxCalibration) blockers.push("CALIBRATION_GATE_FAILED");
  if(x.shadow_observations<minShadow) blockers.push("INSUFFICIENT_SHADOW_EVIDENCE");
  if(x.external_side_effects!==0) blockers.push("SHADOW_SIDE_EFFECT_VIOLATION");
  if(policy.adversarial_eval_pass!==true) blockers.push("ADVERSARIAL_EVAL_NOT_PASS");
  if(policy.drift_rollback_pass!==true) blockers.push("DRIFT_ROLLBACK_NOT_PASS");
  if(policy.finops_budget_pass!==true) blockers.push("FINOPS_BUDGET_NOT_PASS");
  if(policy.human_production_approval!==true) blockers.push("HUMAN_APPROVAL_REQUIRED");
  return {schema:"jadel.model.promotion.v1",decision:blockers.length?"NO_GO":"ELIGIBLE_FOR_GOVERNED_PROMOTION",blockers,evidence:x};
}

export function authorizeAgentAction(a={}){
  const critical=new Set(["CUSTOMER_OUTREACH","PUBLICATION","PAID_SPEND","PAYMENT","CREDENTIAL_CHANGE","PRODUCTION_PROMOTION"]);
  const kind=String(a.kind||"UNKNOWN").toUpperCase();
  if(a.model_only===true) return {allowed:false,reason:"MODEL_OUTPUT_IS_NOT_AUTHORITY"};
  if(critical.has(kind)&&a.human_approval!==true) return {allowed:false,reason:"HUMAN_APPROVAL_REQUIRED"};
  if(a.policy_allowed!==true) return {allowed:false,reason:"POLICY_DENIED"};
  if(a.kill_switch===true) return {allowed:false,reason:"KILL_SWITCH_ACTIVE"};
  return {allowed:true,reason:"DETERMINISTIC_POLICY_PASS"};
}
