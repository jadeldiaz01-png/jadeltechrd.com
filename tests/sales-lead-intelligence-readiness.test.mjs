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
