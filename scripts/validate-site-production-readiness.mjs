import fs from 'node:fs';

const path = 'config/site-production-readiness-2026.json';
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
const errors = [];

const requiredTop = [
  'schema_version','manifest_id','baseline_sha','decision','governance','standards_baseline',
  'architecture','evidence_contract','production_gates','security_controls','supply_chain_controls',
  'reliability','data_governance','ai_and_agentic_controls','quality_and_testing','finops','release_strategy'
];
for (const key of requiredTop) if (!(key in manifest)) errors.push(`missing top-level key: ${key}`);

if (manifest.schema_version !== '2026.1') errors.push('schema_version must be 2026.1');
if (manifest.decision?.fail_closed !== true) errors.push('decision.fail_closed must be true');
if (manifest.decision?.execution_enabled_by_default !== false) errors.push('execution_enabled_by_default must be false');
if (manifest.decision?.production_authorized !== false) errors.push('manifest must remain non-authorizing until runtime evidence promotes it');
if (!/^[0-9a-f]{40}$/.test(manifest.baseline_sha ?? '')) errors.push('baseline_sha must be a 40-hex git SHA');

const requiredInstitutionalGates = ['AUTHORIZED','POLICY_ALLOWED','TOS_ALLOWED','GEO_ALLOWED','RISK_ALLOWED','IDENTITY_ALLOWED','AUDITABLE','IDEMPOTENT','RECONCILABLE'];
const govGates = new Set(manifest.governance?.required_gates ?? []);
for (const gate of requiredInstitutionalGates) if (!govGates.has(gate)) errors.push(`missing governance gate: ${gate}`);

const requiredProductionGates = ['DOMAIN_OWNERSHIP_VERIFIED','GITHUB_PAGES_CNAME','TLS_CERTIFICATE','DIRECT_ORIGIN_4_OF_4','PUBLIC_CURRENT_FINGERPRINT','GOVERNED_INTAKE_LIVE_CONTRACT','ANDROID_11_OF_11','PRODUCTION_DOMAIN_GATE'];
const gates = new Map((manifest.production_gates ?? []).map((gate) => [gate.id, gate]));
for (const gate of requiredProductionGates) if (!gates.has(gate)) errors.push(`missing production gate: ${gate}`);

const acceptedStatuses = new Set(manifest.evidence_contract?.accepted_statuses ?? []);
for (const gate of manifest.production_gates ?? []) {
  if (!acceptedStatuses.has(gate.status)) errors.push(`${gate.id}: invalid status ${gate.status}`);
}

const finalGate = gates.get('PRODUCTION_DOMAIN_GATE');
if (finalGate?.status === 'PASS') {
  for (const dep of finalGate.depends_on ?? []) {
    if (gates.get(dep)?.status !== 'PASS') errors.push(`final gate cannot PASS while ${dep} is ${gates.get(dep)?.status ?? 'missing'}`);
  }
}

const cname = gates.get('GITHUB_PAGES_CNAME');
if (cname?.status === 'PASS' && cname?.observed_value !== 'jadeltechrd.com') {
  errors.push('GITHUB_PAGES_CNAME may PASS only with observed_value=jadeltechrd.com');
}

const prohibitedReadyClaim = manifest.decision?.production_authorized === true && finalGate?.status !== 'PASS';
if (prohibitedReadyClaim) errors.push('production cannot be authorized before PRODUCTION_DOMAIN_GATE=PASS');

const requiredSecurity = ['repository','web','backend','turnstile'];
for (const key of requiredSecurity) if (!Array.isArray(manifest.security_controls?.[key])) errors.push(`security_controls.${key} must be an array`);
if ((manifest.quality_and_testing?.required_layers ?? []).length < 7) errors.push('testing strategy is unexpectedly weak');
if ((manifest.supply_chain_controls?.required ?? []).length < 7) errors.push('supply-chain strategy is unexpectedly weak');
if ((manifest.reliability?.sli ?? []).length < 5) errors.push('reliability SLI set is unexpectedly weak');

if (errors.length) {
  console.error('Site production readiness validation FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Site production readiness validation PASS: ${manifest.production_gates.length} production gates, fail-closed, baseline ${manifest.baseline_sha}.`);
