import fs from 'node:fs';

const manifestPath = 'config/institutional-production-manifest-2026.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];

const requiredTop = [
  'schema_version','manifest_id','baseline_sha','decision','authority_model','architecture',
  'standards_2026','governance','evidence_contract','current_evidence_snapshot',
  'domain_authorization','agentic_and_mcp_security','identity_and_secret_security',
  'software_supply_chain','data_and_knowledge_governance','reliability_and_operations',
  'qa_and_adversarial_evaluation','finops','promotion_policy'
];
for (const key of requiredTop) if (!(key in manifest)) errors.push(`missing top-level key: ${key}`);

if (manifest.schema_version !== '2026.2') errors.push('schema_version must be 2026.2');
if (!/^[0-9a-f]{40}$/.test(manifest.baseline_sha ?? '')) errors.push('baseline_sha must be 40 lowercase hex');
if (manifest.decision?.fail_closed !== true) errors.push('fail_closed must be true');
if (manifest.decision?.execution_enabled_by_default !== false) errors.push('execution_enabled_by_default must be false');

const domains = manifest.domain_authorization ?? {};
const criticalDomainKeys = [
  'public_site','commercial_intake','agent_fleet',
  'external_connectors_and_publication','quant_and_trading','social_media_intelligence',
  'revenue_intelligence'
];
for (const key of criticalDomainKeys) {
  if (!domains[key]) errors.push(`missing domain authorization: ${key}`);
}

if (domains.quant_and_trading?.live_capital_authorized !== false) {
  errors.push('quant_and_trading.live_capital_authorized must remain false until a dedicated capital-promotion workflow changes the policy');
}
if (manifest.decision?.live_financial_capital_authorized !== false) {
  errors.push('institutional live_financial_capital_authorized must remain false in the baseline manifest');
}
if (manifest.decision?.autonomous_external_publication_authorized !== false) {
  errors.push('autonomous_external_publication_authorized must remain false in the baseline manifest');
}
if (domains.revenue_intelligence?.production_authorized !== false) {
  errors.push('revenue_intelligence.production_authorized must remain false until its dedicated evidence gates pass');
}
if (domains.revenue_intelligence?.autonomous_external_actions_authorized !== false) {
  errors.push('revenue_intelligence autonomous external actions must remain false');
}
if (domains.revenue_intelligence?.max_unapproved_ad_spend_usd !== 0) {
  errors.push('revenue_intelligence max_unapproved_ad_spend_usd must remain 0');
}

const accepted = new Set(manifest.evidence_contract?.accepted_statuses ?? []);
const evidence = manifest.current_evidence_snapshot?.evidence ?? [];
for (const item of evidence) {
  for (const field of ['control_id','status','source','observed_at','subject_sha_or_runtime_revision','evidence_locator']) {
    if (!item?.[field]) errors.push(`${item?.control_id ?? 'evidence item'} missing ${field}`);
  }
  if (!accepted.has(item.status)) errors.push(`${item.control_id}: unrecognized status ${item.status}`);
}

const subject = manifest.current_evidence_snapshot?.subject_sha;
if (subject !== manifest.baseline_sha) {
  errors.push('current_evidence_snapshot.subject_sha must equal baseline_sha');
}
for (const item of evidence.filter((x) => x.status === 'PASS')) {
  if (/^[0-9a-f]{40}$/.test(item.subject_sha_or_runtime_revision ?? '') &&
      item.subject_sha_or_runtime_revision !== manifest.baseline_sha) {
    errors.push(`${item.control_id}: PASS is not bound to baseline_sha`);
  }
}

const requiredInstitutional = new Set([
  'AUTHORIZED','POLICY_ALLOWED','TOS_ALLOWED','GEO_ALLOWED','RISK_ALLOWED',
  'IDENTITY_ALLOWED','AUDITABLE','IDEMPOTENT','RECONCILABLE','OBSERVABLE',
  'REVERSIBLE_OR_COMPENSATABLE','COST_BOUNDED'
]);
const actualInstitutional = new Set(manifest.governance?.required_institutional_gates ?? []);
for (const gate of requiredInstitutional) if (!actualInstitutional.has(gate)) errors.push(`missing governance gate: ${gate}`);

const human = new Set(manifest.governance?.human_approval_required_for ?? []);
for (const action of ['production_promotion','credential_or_permission_change','external_publication','financial_side_effect','destructive_action','live_trading_or_capital_allocation']) {
  if (!human.has(action)) errors.push(`human approval missing for: ${action}`);
}

const supply = new Set(manifest.software_supply_chain?.required_before_promotion ?? []);
for (const control of ['SBOM','provenance','artifact attestation','attestation verification']) {
  if (![...supply].some((v) => v.toLowerCase() === control.toLowerCase())) {
    errors.push(`supply-chain promotion control missing: ${control}`);
  }
}

if (manifest.decision?.institutional_production_authorized === true) {
  const unauthorized = Object.entries(domains)
    .filter(([, value]) => value && typeof value === 'object' && 'production_authorized' in value && value.production_authorized !== true)
    .map(([key]) => key);
  if (unauthorized.length) errors.push(`institutional production cannot be true while domains are not authorized: ${unauthorized.join(', ')}`);
}

if (errors.length) {
  console.error('Institutional production manifest validation FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Institutional manifest PASS: baseline=${manifest.baseline_sha}, evidence=${evidence.length}, fail_closed=true, institutional_production_authorized=${manifest.decision.institutional_production_authorized}`);
