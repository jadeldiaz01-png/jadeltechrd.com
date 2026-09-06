import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('config/service-capability-registry.json', 'utf8'));
const app = fs.readFileSync('app.js', 'utf8');
const readiness = fs.readFileSync('config/agent-readiness-data.js', 'utf8');

const fail = (message) => {
  console.error(`SERVICE_CAPABILITY_REGISTRY=FAIL ${message}`);
  process.exit(1);
};

if (registry.schema_version !== '1.0.0') fail('unsupported schema version');
if (!registry.policy?.default_deny) fail('default_deny must be true');
if (registry.policy?.financial_live_authority !== false) fail('financial live authority must remain false');
if (!registry.policy?.critical_external_actions_require_human_approval) fail('HITL policy missing');

const serviceIds = [...app.matchAll(/\bid:\s*"([a-z0-9-]+)"[\s\S]*?\bcategory:\s*"[a-z]+"/g)].map((match) => match[1]);
const expected = [...new Set(serviceIds)].sort();
const actual = registry.services.map((service) => service.id).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  fail(`homepage/registry drift expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}

const shaRe = /^[0-9a-f]{40}$/;
for (const service of registry.services) {
  if (!service.public_name || !service.public_status || !service.claim_level) fail(`${service.id}: incomplete public contract`);
  if (!Array.isArray(service.capabilities) || service.capabilities.length === 0) fail(`${service.id}: capabilities missing`);
  if (!Array.isArray(service.remaining_gates) || service.remaining_gates.length === 0) fail(`${service.id}: remaining_gates missing`);
  if (!Array.isArray(service.evidence_repositories) || service.evidence_repositories.length === 0) fail(`${service.id}: evidence repositories missing`);
  for (const evidence of service.evidence_repositories) {
    if (!/^jadeldiaz01-png\/[A-Za-z0-9._-]+$/.test(evidence.repository || '')) fail(`${service.id}: invalid repository`);
    if (!shaRe.test(evidence.sha || '')) fail(`${service.id}: source SHA must be exact lowercase 40-char SHA`);
  }
}

const byId = new Map(registry.services.map((service) => [service.id, service]));
for (const restricted of ['revenue', 'quant']) {
  const service = byId.get(restricted);
  if (!Array.isArray(service?.prohibited_claims) || service.prohibited_claims.length === 0) fail(`${restricted}: prohibited_claims required`);
}
if (!byId.get('quant')?.claim_level.includes('RESEARCH')) fail('quant must remain research/testnet only');
if (/PRODUCTION_READY|LIVE_CAPITAL_AUTHORIZED/.test(byId.get('quant')?.claim_level || '')) fail('quant live claim prohibited');

for (const service of registry.services) {
  for (const evidence of service.evidence_repositories) {
    if (readiness.includes(`repository:\"${evidence.repository}\"`) && !readiness.includes(evidence.sha)) {
      fail(`${service.id}: public readiness contains repository ${evidence.repository} but not current evidence SHA`);
    }
  }
}

console.log(`SERVICE_CAPABILITY_REGISTRY=PASS services=${registry.services.length}`);
