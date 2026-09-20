import fs from "node:fs";

const control = JSON.parse(fs.readFileSync("config/revenue-intelligence-control-plane-2026.json", "utf8"));
const models = JSON.parse(fs.readFileSync("config/revenue-model-registry-2026.json", "utf8"));
const agent = JSON.parse(fs.readFileSync("config/revenue-agent-spec-2026.json", "utf8"));
const analytics = JSON.parse(fs.readFileSync("config/analytics-control-plane-v1.json", "utf8"));
const errors = [];

function requireValue(condition, message) {
  if (!condition) errors.push(message);
}

requireValue(control.schema_version === "2026.1", "unexpected revenue control-plane schema");
requireValue(control.decision?.production_authorized === false, "production_authorized must remain false");
requireValue(control.decision?.execution_enabled_by_default === false, "execution_enabled_by_default must remain false");
requireValue(control.decision?.fail_closed === true, "fail_closed must be true");
requireValue(control.decision?.autonomous_external_side_effects_authorized === false, "autonomous external side effects must remain false");
requireValue(control.decision?.max_unapproved_ad_spend_usd === 0, "unapproved ad spend must be zero");
requireValue(control.decision?.live_financial_capital_authorized === false, "live capital must remain false");
requireValue(control.runtime_integration?.endpoint_mode === "READ_ONLY_AGGREGATE", "admin revenue endpoint must remain aggregate read-only");

const human = new Set(control.authority_model?.human_approval_required_for ?? []);
for (const action of ["paid_media_spend","external_publication","payment_or_refund","credential_or_permission_change","production_promotion","live_trading_or_capital_allocation"]) {
  requireValue(human.has(action), `human approval missing for ${action}`);
}

requireValue(models.policy?.production_authorized === false, "model registry production authorization must remain false");
requireValue(models.policy?.critical_action_authority_from_model_output === false, "model outputs cannot authorize critical actions");
requireValue(models.policy?.max_unapproved_ad_spend_usd === 0, "model registry unapproved ad spend must be zero");

const ids = new Set();
for (const model of models.models ?? []) {
  requireValue(model.id && !ids.has(model.id), `duplicate or missing model id: ${model.id}`);
  ids.add(model.id);
  requireValue(model.critical_action_authority === false, `${model.id}: critical_action_authority must be false`);
}
requireValue(models.models?.some((m) => m.id === "lead-propensity-dnn" && /RESEARCH_ONLY/.test(m.state)), "DNN candidate must remain research-only");
requireValue(models.models?.some((m) => m.id === "llm-revenue-analyst" && /HUMAN_GATED/.test(m.state)), "LLM analyst must be human-gated");
requireValue(models.models?.some((m) => m.id === "multimodal-creative-qc" && /HUMAN_GATED/.test(m.state)), "multimodal QC must be human-gated");

requireValue(agent.activation_state === "NOT_ACTIVATED_PENDING_EVALS_AND_RUNTIME_POLICY", "revenue agent must remain not activated");
requireValue(agent.authority?.mode === "ADVISORY_ONLY", "revenue agent authority must be advisory-only");
for (const key of ["external_side_effects","paid_media_spend","publication","customer_outreach","payment_or_refund","credential_changes","production_promotion","live_trading_or_capital"]) {
  requireValue(agent.authority?.[key] === false, `revenue agent authority must deny ${key}`);
}
const forbidden = new Set(agent.forbidden_tools ?? []);
for (const tool of ["publish_social","change_ad_budget","charge_payment","issue_refund","deploy_production","place_trade"]) {
  requireValue(forbidden.has(tool), `revenue agent forbidden tool missing: ${tool}`);
}
requireValue(agent.context_and_memory?.persistent_memory_enabled === false, "revenue agent persistent memory must default off");
requireValue(agent.context_and_memory?.pii_allowed === false, "revenue agent PII must be disallowed");
requireValue(agent.structured_output?.required === true, "revenue agent structured output required");
requireValue(agent.structured_output?.authorization_field_hardcoded === "NO_EXTERNAL_SIDE_EFFECTS", "revenue agent authorization output must be hardcoded safe");

const analyticsText = JSON.stringify(analytics);
for (const expected of ["555066228","15812262707","G-K60SQ2ZHL9"]) {
  requireValue(analyticsText.includes(expected), `analytics identity missing: ${expected}`);
}

const serialized = JSON.stringify({control, models, agent});
for (const secretPattern of [/sk-[A-Za-z0-9_-]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /api[_-]?secret["']?\s*:\s*["'][^"']+/i]) {
  requireValue(!secretPattern.test(serialized), "secret-like material must not be committed to revenue manifests");
}

if (errors.length) {
  console.error("Revenue intelligence control-plane validation FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`REVENUE_INTELLIGENCE_CONTROL_PLANE=PASS models=${models.models.length} authority=RECOMMEND_ONLY`);
