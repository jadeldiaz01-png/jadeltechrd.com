import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MANIFEST = 'config/sales-lead-intelligence-production-readiness-2026.json';
const fail = (message) => { throw new Error('SALES_READINESS_FAIL: ' + message); };
const eq = (value, expected, label) => { if (value !== expected) fail(label); };
const nonEmpty = (x) => typeof x === 'string' && x.trim().length > 0;
const gitSha = (p) => execFileSync('git', ['hash-object', p], { encoding: 'utf8' }).trim();
const isSha = (s) => /^[a-f0-9]{40}$/.test(s || '');

export function validateSalesManifest(m, publicCatalog, readiness, capabilityRegistry, verifyBlobs = false) {
  eq(m.schema_version, '2026-10-08.1', 'schema version');
  eq(m.service_id, 'sales', 'service id');
  eq(m.claim?.public_maturity, 'SUPERVISED_PILOT', 'maturity must remain a supervised pilot');
  eq(m.claim?.operational_state, 'BLOCKED', 'not operationally certified');
  for (const prop of ['production_ready','production_authorized','external_outreach_enabled','auto_publish_enabled','live_financial_execution_enabled']) {
    eq(m.claim?.[prop], false, prop + ' must be false');
  }
  eq(m.claim?.max_autonomous_capital_usd, 0, 'autonomous capital');
  eq(m.claim?.require_explicit_human_promotion, true, 'human promotion');
  eq(m.authority?.stop_on_missing_approval, true, 'stop on missing approval');
  eq(m.authority?.bulk_outreach, false, 'bulk outreach prohibited');
  eq(m.authority?.anti_bot_bypass, false, 'anti-bot bypass prohibited');
  eq(m.authority?.impersonation, false, 'impersonation prohibited');
  eq(m.data?.cross_tenant_retrieval, false, 'cross-tenant retrieval');
  eq(m.data?.model_training_on_customer_pii, false, 'model training on PII');
  eq(m.data?.retention_requires_approved_schedule, true, 'retention schedule missing');
  eq(m.data?.suppression_list_checked_at_decision_and_send, true, 'suppression enforcement');
  eq(m.connectors?.crm?.write_enabled, false, 'CRM write gate');
  eq(m.connectors?.email?.send_enabled, false, 'email send gate');
  eq(m.connectors?.whatsapp?.send_enabled, false, 'WhatsApp send gate');
  eq(m.connectors?.social?.publish_enabled, false, 'social publish gate');
  eq(m.connectors?.mcp?.external_writes_enabled, false, 'MCP write gate');
  eq(m.connectors?.mcp?.tools_default_deny, true, 'MCP default deny');
  eq(m.finops?.max_external_autonomous_spend_usd, 0, 'FinOps autonomous spending');
  eq(m.finops?.external_spend_approved, false, 'FinOps external spend');
  eq(m.evaluation?.production_quality_certified, false, 'unverified ML quality');
  eq(m.evaluation?.verified_campaign_count, 0, 'campaign evidence is missing');
  eq(m.evaluation?.current_measured_metrics, null, 'actual measured metrics cannot be fabricated');
  eq(m.supply_chain?.provenance_verified_for_service, false, 'provenance not verified');
  eq(m.reliability?.production_slo_certified, false, 'production SLO not certified');
  eq(m.reliability?.restore_drill_passed, false, 'restore drill not certified');
  if (!Array.isArray(m.evidence?.production_receipts) || m.evidence.production_receipts.length !== 0) fail('unexpected production receipts');
  if (!Array.isArray(m.evidence?.evidence_missing) || m.evidence.evidence_missing.length < 7) fail('missing blockers inventory');
  if (!Array.isArray(m.source_references) || m.source_references.length < 8) fail('primary research references absent');
  const requiredGates = ['G0_code_contract','G1_data_privacy','G2_security_supply_chain','G3_offline_quant_evaluation','G4_connector_sandbox','G5_supervised_campaign','G6_recovery_SLO_finops','G7_human_production_promotion'];
  for (const key of requiredGates) {
    const g = m.gates?.[key];
    if (!g || !['PENDING','BLOCKED'].includes(g.status) || g.evidence_ref !== null) {
      fail(key + ' cannot be promoted without independently verifiable evidence and new review');
    }
  }
  if (Object.keys(m.gates || {}).length !== requiredGates.length) fail('gate inventory drift');

  const sales = publicCatalog.services?.find(s => s.id === 'sales');
  const readinessSales = readiness.services?.find(s => s.id === 'sales');
  const registrySales = capabilityRegistry.services?.find(s => s.id === 'sales');
  if (!sales || !readinessSales || !registrySales) fail('service must exist in all three catalogs');
  eq(sales.maturity, m.claim.public_maturity, 'public catalog claim mismatch');
  eq(readinessSales.decision, 'BLOCKED', 'readiness decision must remain BLOCKED');
  eq(readinessSales.catalog_status, 'pilot', 'readiness catalog must remain pilot');
  eq(registrySales.claim_level, 'SUPERVISED_PILOT', 'capability registry must remain pilot');
  eq(sales.pricing?.setup?.amount_minor, 150000, 'existing setup minimum changed');
  eq(sales.pricing?.monthly?.amount_minor, 29900, 'existing monthly price changed');
  if (readinessSales.service_specific_gates?.crm_or_delivery_connector_verified !== false
      || readinessSales.service_specific_gates?.consent_and_contact_policy_verified !== false
      || readinessSales.service_specific_gates?.identity_and_tos_checks !== false) {
    fail('unverified connectors, consent, or platform eligibility unexpectedly promoted');
  }
  if (!Array.isArray(readinessSales.blocking_gates) || readinessSales.blocking_gates.length < 3) fail('missing production blockers');

  const pinned = new Map((m.evidence?.code_observations || []).map(x => [x.path, x.blob_sha]));
  for (const path of ['agent-services.json','config/service-capability-registry.json','config/agent-production-readiness.json','commercial-runtime/src/service-pricing.mjs']) {
    if (!isSha(pinned.get(path))) fail('missing immutable blob pin: ' + path);
    if (verifyBlobs && gitSha(path) !== pinned.get(path)) fail('source blob changed: ' + path);
  }
  return true;
}

export function loadAndValidate() {
  const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  return validateSalesManifest(read(MANIFEST), read('agent-services.json'), read('config/agent-production-readiness.json'), read('config/service-capability-registry.json'), true);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { loadAndValidate(); console.log('SALES_LEAD_READINESS=PASS contract_only=true production_authorized=false'); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
