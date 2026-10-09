import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateSalesManifest, loadAndValidate } from '../scripts/validate-sales-lead-intelligence-readiness.mjs';
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const manifest = read('config/sales-lead-intelligence-production-readiness-2026.json');
const catalog = read('agent-services.json');
const readiness = read('config/agent-production-readiness.json');
const registry = read('config/service-capability-registry.json');
const check = (m, c=catalog, r=readiness, g=registry) => validateSalesManifest(m,c,r,g,false);

test('contract matches immutable source blobs and pre-existing fail-closed public service', () => assert.equal(loadAndValidate(), true));
test('baseline manifest validates', () => assert.equal(check(manifest),true));

const forbidden = [
  ['production readiness without evidence', m => {m.claim.production_ready = true;}],
  ['external outreach without consent', m => {m.claim.external_outreach_enabled = true;}],
  ['unauthorized CRM mutation', m => {m.connectors.crm.write_enabled = true;}],
  ['unauthorized email', m => {m.connectors.email.send_enabled = true;}],
  ['unauthorized WhatsApp', m => {m.connectors.whatsapp.send_enabled = true;}],
  ['MCP write expansion', m => {m.connectors.mcp.external_writes_enabled = true;}],
  ['cross tenant leakage', m => {m.data.cross_tenant_retrieval = true;}],
  ['PII model training', m => {m.data.model_training_on_customer_pii = true;}],
  ['money authority', m => {m.finops.max_external_autonomous_spend_usd = 1;}],
  ['false ML measurement', m => {m.evaluation.current_measured_metrics = {auprc:0.99};}],
  ['fictional provider receipt', m => {m.evidence.production_receipts.push({id:'fiction'});}],
  ['self-certified gate', m => {m.gates.G4_connector_sandbox={status:'PASS',evidence_ref:null};}],
  ['false SLO', m => {m.reliability.production_slo_certified = true;}],
  ['false supply chain attestation', m => {m.supply_chain.provenance_verified_for_service = true;}],
  ['bypass suppression', m => {m.data.suppression_list_checked_at_decision_and_send = false;}],
  ['remove human approval', m => {m.authority.stop_on_missing_approval = false;}],
  ['fake verified campaigns', m => {m.evaluation.verified_campaign_count = 7;}]
];
for (const [name, mutate] of forbidden) {
  test('rejects ' + name, () => {
    const m = structuredClone(manifest); mutate(m);
    assert.throws(() => check(m), /SALES_READINESS_FAIL/);
  });
}
test('rejects public catalog maturity promotion without evidence', () => {
  const c=structuredClone(catalog);
  c.services.find(x => x.id==='sales').maturity='PRODUCTION_READY';
  assert.throws(()=>check(manifest,c),/SALES_READINESS_FAIL/);
});
test('rejects source registry promotion without evidence', () => {
  const g=structuredClone(registry);
  g.services.find(x=>x.id==='sales').claim_level='PRODUCTION_READY';
  assert.throws(()=>check(manifest,catalog,readiness,g),/SALES_READINESS_FAIL/);
});
test('rejects removing existing readiness blockers', () => {
  const r=structuredClone(readiness);
  r.services.find(x=>x.id==='sales').blocking_gates=[];
  assert.throws(()=>check(manifest,catalog,r),/SALES_READINESS_FAIL/);
});


const poisonedEvidence = [
  ['joined identifier bypass using delimiter collision', m => {
    const ids = [...m.evidence.evidence_missing].sort();
    ids.splice(0,2,ids[0] + '|' + ids[1]);
    m.evidence.evidence_missing = ids;
  }],
  ['forged code evidence narrative', m => {m.evidence.code_observations[0].fact = 'Production deployed and independently certified';}],
  ['diluted cross-repo disclaimer', m => {m.evidence.cross_repository_provenance.warning = 'not evidence of executable runtime identity; but verified now';}],
  ['missing consent blocker', m => {m.evidence.evidence_missing = m.evidence.evidence_missing.filter(x => x !== 'consent_and_jurisdiction_review');}],
  ['duplicate blocker masquerading as full inventory', m => {m.evidence.evidence_missing[1] = m.evidence.evidence_missing[0];}],
  ['fabricated extra blocker identifier', m => {m.evidence.evidence_missing.push('false_proof');}],
  ['missing mandatory source', m => {m.source_references.pop();}],
  ['duplicate research source ID', m => {m.source_references[1].id = m.source_references[0].id;}],
  ['substituted unofficial research source URL', m => {m.source_references[0].url = 'https://example.com/claim-production-ready';}],
  ['unsupported research source date', m => {m.source_references[0].as_of = '2029-10-08';}],
  ['research source marked independently verified without evidence', m => {m.source_references[0].verification_status = 'VERIFIED';}],
  ['research source with hidden verification field', m => {m.source_references[0].verified = true;}],
  ['missing mandatory code evidence', m => {m.evidence.code_observations.pop();}],
  ['repeated code evidence ID', m => {m.evidence.code_observations[1].id = m.evidence.code_observations[0].id;}],
  ['swapped code observation ID/path pairing', m => {m.evidence.code_observations[1].id = 'sales_public_catalog';}],
  ['invalid code evidence SHA', m => {m.evidence.code_observations[0].blob_sha = '123';}],
  ['code evidence false extra certification', m => {m.evidence.code_observations[0].production_verified = true;}],
  ['missing cross-repository provenance contract', m => {delete m.evidence.cross_repository_provenance;}],
  ['cross repo false build certification', m => {m.evidence.cross_repository_provenance.executable_build_binding_verified = true;}],
  ['cross repo false attestation', m => {m.evidence.cross_repository_provenance.attestation_verified = true;}],
  ['cross repo runtime digest without certification', m => {m.evidence.cross_repository_provenance.runtime_release_digest = 'sha256:' + '1'.repeat(64);}],
  ['cross repo forged attestation reference', m => {m.evidence.cross_repository_provenance.signed_provenance_reference = 'https://example.com/receipt';}],
  ['cross repo fictional verified receipt', m => {m.evidence.cross_repository_provenance.independently_verified_receipts = ['forged'];}],
  ['cross repo expands authority', m => {m.evidence.cross_repository_provenance.production_authority = true;}],
  ['cross repo changes scope', m => {m.evidence.cross_repository_provenance.scope = 'RUNTIME_CERTIFIED';}],
  ['cross repo omits requisite artifact proof', m => {m.evidence.cross_repository_provenance.required_independent_evidence.pop();}],
  ['cross repo rewrites referenced SHA', m => {m.evidence.cross_repository_provenance.registry_referenced_commit_sha = '0'.repeat(40);}],
  ['cross repo changes referenced source repository', m => {m.evidence.cross_repository_provenance.source_repository = 'other/repo';}],
  ['cross repo hides evidence uncertainty', m => {m.evidence.cross_repository_provenance.warning = 'verified';}]
];
for (const [name, mutate] of poisonedEvidence) {
  test('P2 fail closed: ' + name, () => {
    const m=structuredClone(manifest);
    mutate(m);
    assert.throws(() => check(m), /SALES_READINESS_FAIL/);
  });
}

test('P2 rejects false sales registry citation of external source SHA', () => {
  const g=structuredClone(registry);
  g.services.find(x => x.id === 'sales').evidence_repositories
    .find(x => x.repository === manifest.baseline.revenue_repository).sha = '0'.repeat(40);
  assert.throws(() => check(manifest,catalog,readiness,g), /SALES_READINESS_FAIL/);
});
test('P2 rejects mismatch of sales readiness source commit SHA', () => {
  const r=structuredClone(readiness);
  r.services.find(x => x.id === 'sales').source_sha='f'.repeat(40);
  assert.throws(() => check(manifest,catalog,r), /SALES_READINESS_FAIL/);
});
