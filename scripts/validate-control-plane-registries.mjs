import fs from 'node:fs';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const fail = (message) => { throw new Error(message); };
const unique = (values, label) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`${label}: duplicate ${value}`);
    seen.add(value);
  }
};

const control = readJson('config/control-plane-registry.json');
const agents = readJson('config/agent-production-manifest.json');
const platforms = readJson('config/platform-registry.json');
const slo = readJson('config/slo-policy.json');
const bao = readJson('infra/openbao/workload-identities.json');

if (control.execution_defaults?.enabled !== false) fail('control plane must default execution to disabled');
if (control.execution_defaults?.fail_closed !== true) fail('control plane must fail closed');

const requiredGates = [
  'AUTHORIZED','POLICY_ALLOWED','TOS_ALLOWED','GEO_ALLOWED','RISK_ALLOWED',
  'IDENTITY_ALLOWED','AUDITABLE','IDEMPOTENT','RECONCILABLE',
];
for (const gate of requiredGates) {
  if (!control.required_gates?.includes(gate)) fail(`control-plane missing gate ${gate}`);
  if (!agents.control_plane?.policy?.required_gates?.includes(gate)) fail(`agent manifest missing gate ${gate}`);
}

unique((agents.agents || []).map((x) => x.id), 'agent registry');
unique((platforms.platforms || []).map((x) => x.id), 'platform registry');
unique((slo.services || []).map((x) => x.service_id), 'SLO policy');
unique((bao.identities || []).map((x) => x.id), 'OpenBao identities');

const allowedMaturity = new Set(['service', 'pilot', 'research']);
for (const agent of agents.agents || []) {
  if (!allowedMaturity.has(agent.maturity)) fail(`agent ${agent.id}: invalid maturity`);
  if (!Array.isArray(agent.production_blockers)) fail(`agent ${agent.id}: blockers must be array`);
  if (agent.maturity !== 'service' && /PRODUCTION_READY/.test(agent.production_state || '')) {
    fail(`agent ${agent.id}: non-service agent cannot claim production ready`);
  }
}

const allowedPlatformStatus = new Set(['verified_runtime', 'integration_ready', 'pilot', 'blocked']);
for (const platform of platforms.platforms || []) {
  if (!allowedPlatformStatus.has(platform.status)) fail(`platform ${platform.id}: invalid status`);
  if (!Array.isArray(platform.required_gates) || platform.required_gates.length === 0) fail(`platform ${platform.id}: gates required`);
  if (!Array.isArray(platform.production_blockers)) fail(`platform ${platform.id}: blockers must be array`);
  if (platform.external_side_effects === true && platform.human_approval_required !== true && platform.id !== 'github') {
    fail(`platform ${platform.id}: external side effects require explicit human gate declaration`);
  }
}

if (slo.telemetry_privacy?.pii_in_operational_logs !== false) fail('operational telemetry must prohibit PII');
for (const service of slo.services || []) {
  if (!(service.objective > 0 && service.objective <= 1)) fail(`SLO ${service.service_id}: objective out of range`);
}

const expectedIdentities = new Set([
  'agia-control','agia-research','agia-execution','agia-migration','agia-backup','agia-observability','agia-ci',
]);
const actualIdentities = new Set((bao.identities || []).map((x) => x.id));
if (expectedIdentities.size !== actualIdentities.size || [...expectedIdentities].some((x) => !actualIdentities.has(x))) {
  fail('OpenBao workload identity set drifted');
}
if (bao.static_root_tokens_forbidden !== true || bao.tls_required !== true || bao.audit_device_required !== true) {
  fail('OpenBao baseline security requirements must remain enabled');
}
for (const identity of bao.identities || []) {
  const policyPath = `infra/openbao/policies/${identity.id}.hcl`;
  if (!fs.existsSync(policyPath)) fail(`OpenBao identity ${identity.id}: missing policy file`);
  const hcl = fs.readFileSync(policyPath, 'utf8');
  if (/capabilities\s*=\s*\[[^\]]*"sudo"/s.test(hcl)) fail(`${identity.id}: sudo capability forbidden`);
  if (/path\s+"\*"/.test(hcl)) fail(`${identity.id}: wildcard root path forbidden`);
}

const serialized = JSON.stringify({ control, platforms, slo, bao }).toLowerCase();
for (const forbidden of ['sk-proj-', 'bearer ey', '-----begin private key-----']) {
  if (serialized.includes(forbidden)) fail(`registry appears to contain a secret pattern: ${forbidden}`);
}

console.log(`CONTROL_PLANE_REGISTRY_VALID=PASS agents=${agents.agents.length} platforms=${platforms.platforms.length} slos=${slo.services.length} identities=${bao.identities.length}`);
