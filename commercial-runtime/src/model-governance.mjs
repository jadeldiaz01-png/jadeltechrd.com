const finite01=(v,n)=>{const x=Number(v);if(!Number.isFinite(x)||x<0||x>1)throw new Error("INVALID_"+n.toUpperCase());return x;};
const finiteCount=(v,n)=>{const x=Number(v);if(!Number.isInteger(x)||x<0)throw new Error("INVALID_"+n.toUpperCase());return x;};

function validInstant(value,name){
  const t=Date.parse(String(value||""));
  if(!Number.isFinite(t)) throw new Error("INVALID_"+name.toUpperCase());
  return t;
}

export function validateModelEvidence(e={}){
  const required=[
    "model_id","model_kind","training_cutoff","evaluation_start","evaluation_end",
    "dataset_sha256","code_sha","metrics","labeled_samples","positive_labels"
  ];
  for(const k of required) if(e[k]===undefined||e[k]===null||e[k]==="") throw new Error("MISSING_"+k.toUpperCase());

  const training=validInstant(e.training_cutoff,"training_cutoff");
  const start=validInstant(e.evaluation_start,"evaluation_start");
  const end=validInstant(e.evaluation_end,"evaluation_end");
  if(training>=start) throw new Error("TEMPORAL_LEAKAGE_RISK");
  if(start>=end) throw new Error("INVALID_EVALUATION_WINDOW");
  if(!/^[a-f0-9]{64}$/i.test(e.dataset_sha256)) throw new Error("INVALID_DATASET_SHA256");
  if(!/^[a-f0-9]{40}$/i.test(e.code_sha)) throw new Error("INVALID_CODE_SHA");

  const labeled=finiteCount(e.labeled_samples,"labeled_samples");
  const positives=finiteCount(e.positive_labels,"positive_labels");
  if(positives>labeled) throw new Error("POSITIVE_LABEL_COUNT_INVALID");

  return {
    model_id:String(e.model_id).slice(0,120),
    model_kind:String(e.model_kind).toUpperCase().slice(0,80),
    dataset_sha256:e.dataset_sha256.toLowerCase(),
    code_sha:e.code_sha.toLowerCase(),
    training_cutoff:new Date(training).toISOString(),
    evaluation_start:new Date(start).toISOString(),
    evaluation_end:new Date(end).toISOString(),
    pr_auc:finite01(e.metrics.pr_auc,"pr_auc"),
    baseline_pr_auc:finite01(e.metrics.baseline_pr_auc??0,"baseline_pr_auc"),
    brier:finite01(e.metrics.brier,"brier"),
    calibration_error:finite01(e.metrics.calibration_error,"calibration_error"),
    labeled_samples:labeled,
    positive_labels:positives,
    shadow_observations:finiteCount(e.shadow_observations||0,"shadow_observations"),
    external_side_effects:finiteCount(e.external_side_effects||0,"external_side_effects")
  };
}

export function promotionDecision(e={},policy={}){
  const x=validateModelEvidence(e);
  const minShadow=Number(policy.min_shadow_observations??100);
  const maxCalibration=Number(policy.max_calibration_error??0.10);
  const minPrAuc=Number(policy.min_pr_auc??0.50);
  const minLabeled=Number(policy.min_labeled_samples??200);
  const minPositive=Number(policy.min_positive_labels??20);
  const minLift=Number(policy.min_pr_auc_lift_over_baseline??0.01);
  const blockers=[];

  if(x.labeled_samples<minLabeled) blockers.push("INSUFFICIENT_LABELED_SAMPLES");
  if(x.positive_labels<minPositive) blockers.push("INSUFFICIENT_POSITIVE_LABELS");
  if(x.pr_auc<minPrAuc) blockers.push("PR_AUC_BELOW_GATE");
  if(x.pr_auc-x.baseline_pr_auc<minLift) blockers.push("BASELINE_LIFT_GATE_FAILED");
  if(x.calibration_error>maxCalibration) blockers.push("CALIBRATION_GATE_FAILED");
  if(x.shadow_observations<minShadow) blockers.push("INSUFFICIENT_SHADOW_EVIDENCE");
  if(x.external_side_effects!==0) blockers.push("SHADOW_SIDE_EFFECT_VIOLATION");

  for(const [flag,code] of [
    ["point_in_time_lineage_pass","POINT_IN_TIME_LINEAGE_NOT_PASS"],
    ["leakage_test_pass","LEAKAGE_TEST_NOT_PASS"],
    ["slice_analysis_pass","SLICE_ANALYSIS_NOT_PASS"],
    ["independent_reproduction_pass","INDEPENDENT_REPRODUCTION_NOT_PASS"],
    ["adversarial_eval_pass","ADVERSARIAL_EVAL_NOT_PASS"],
    ["drift_rollback_pass","DRIFT_ROLLBACK_NOT_PASS"],
    ["finops_budget_pass","FINOPS_BUDGET_NOT_PASS"]
  ]) if(policy[flag]!==true) blockers.push(code);

  if(x.model_kind.includes("DNN")){
    const dnnMin=Number(policy.dnn_min_labeled_samples??2000);
    if(x.labeled_samples<dnnMin) blockers.push("DNN_DATA_VOLUME_GATE_FAILED");
    if(policy.deep_learning_incremental_value_pass!==true) blockers.push("DNN_INCREMENTAL_VALUE_NOT_PASS");
    if(policy.training_reproducibility_pass!==true) blockers.push("DNN_REPRODUCIBILITY_NOT_PASS");
  }

  if(policy.human_production_approval!==true) blockers.push("HUMAN_APPROVAL_REQUIRED");
  return {
    schema:"jadel.model.promotion.v2",
    decision:blockers.length?"NO_GO":"ELIGIBLE_FOR_GOVERNED_PROMOTION",
    blockers,
    evidence:x,
    production_authorized:false
  };
}

export function authorizeAgentAction(a={}){
  const critical=new Set([
    "CUSTOMER_OUTREACH","PUBLICATION","PAID_SPEND","PAYMENT","REFUND",
    "SETTLEMENT_RECORD","CREDENTIAL_CHANGE","PRODUCTION_PROMOTION",
    "MODEL_PROMOTION","EXTERNAL_DATA_EXPORT","OUTBOUND_WEBHOOK","DESTRUCTIVE_ACTION"
  ]);
  const kind=String(a.kind||"UNKNOWN").toUpperCase();
  if(a.model_only===true) return {allowed:false,reason:"MODEL_OUTPUT_IS_NOT_AUTHORITY"};
  if(a.kill_switch===true) return {allowed:false,reason:"KILL_SWITCH_ACTIVE"};
  if(critical.has(kind)&&a.human_approval!==true) return {allowed:false,reason:"HUMAN_APPROVAL_REQUIRED"};
  if(a.policy_allowed!==true) return {allowed:false,reason:"POLICY_DENIED"};
  return {allowed:true,reason:"DETERMINISTIC_POLICY_PASS"};
}
