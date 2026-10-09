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
  // P2-1: Exact source/blocker inventories. A passing count is not evidence quality.
  // References are a frozen research index, NEVER authenticated web/provider receipts.
  const requiredBlockers = [
    'crm_connector_authz_and_sandbox',
    'consent_and_jurisdiction_review',
    'campaign_delivery_provider_receipts',
    'suppression_enforcement_e2e',
    'tenant_isolation_adversarial_e2e',
    'point_in_time_calibration_report',
    'signed_release_attestation',
    'restore_drill_and_SLO_window',
    'approved_operational_budget'
  ];
  const expectedSources = {
    nist_ai_rmf: 'https://www.nist.gov/itl/ai-risk-management-framework',
    nist_ssdf: 'https://csrc.nist.gov/pubs/sp/800/218/final',
    owasp_agent_security: 'https://genai.owasp.org/2026/09/01/owasp-genai-security-project-unveils-2026-top-10-for-llm-applications-new-agent-control-standard-and-sponsors-as-community-tops-30000-members/',
    slsa_build_integrity: 'https://slsa.dev/spec/v1.2/',
    ftc_email_marketing: 'https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business',
    eu_data_subject_rights: 'https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en',
    eu_ai_regulatory_framework: 'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
    gmail_sender_guidelines: 'https://support.google.com/mail/answer/81126?hl=en',
    do_legal_portal: 'https://www.dgcp.gob.do/transparencia/marco-legal'
  };
  const codeEvidenceIds = {
    'agent-services.json': 'sales_public_catalog',
    'config/service-capability-registry.json': 'sales_capability_registry',
    'config/agent-production-readiness.json': 'sales_readiness_gate',
    'commercial-runtime/src/service-pricing.mjs': 'sales_price_catalog'
  };
  const exactRecord = (x, keys, name) => {
    if (x === null || typeof x !== 'object' || Array.isArray(x) ||
        Object.keys(x).sort().join('|') !== [...keys].sort().join('|')) fail(name + ': invalid record shape');
  };
  const exactIds = (ids, expected, name) => {
    if (!Array.isArray(ids) || ids.some(x => typeof x !== 'string') ||
        ids.length !== new Set(ids).size ||
        [...ids].sort().join('|') !== [...expected].sort().join('|')) fail(name + ': missing/duplicate/extra evidence IDs');
  };
  if (!Array.isArray(m.evidence?.production_receipts) || m.evidence.production_receipts.length !== 0) fail('unexpected production receipts');
  exactIds(m.evidence?.evidence_missing, requiredBlockers, 'blocked evidence');
  if (!Array.isArray(m.source_references)) fail('research sources not an array');
  exactIds(m.source_references.map(x => x?.id), Object.keys(expectedSources), 'research source IDs');
  for (const source of m.source_references) {
    exactRecord(source, ['id','kind','url','as_of','verification_status'], 'research source');
    eq(source.kind, 'external_primary', source.id + ': kind');
    eq(source.url, expectedSources[source.id], source.id + ': unauthorized URL substitution');
    eq(source.as_of, '2026-10-08', source.id + ': frozen review date');
    eq(source.verification_status, 'REFERENCE_ONLY_NOT_INDEPENDENTLY_VERIFIED', source.id + ': unverifiable certification');
  }
  if (!Array.isArray(m.evidence.code_observations)) fail('code observations not an array');
  exactIds(m.evidence.code_observations.map(x => x?.id), Object.values(codeEvidenceIds), 'code observation IDs');
  exactIds(m.evidence.code_observations.map(x => x?.path), Object.keys(codeEvidenceIds), 'code observation paths');
  for (const observation of m.evidence.code_observations) {
    exactRecord(observation, ['id','path','blob_sha','fact'], 'code observation');
    eq(observation.id, codeEvidenceIds[observation.path], 'code evidence ID/path binding');
    if (!isSha(observation.blob_sha) || !nonEmpty(observation.fact) || observation.fact.length > 300) {
      fail('code observation missing valid blob SHA/factual statement');
    }
  }
  // P2-2: A SHA copied from the sales registry is not an independently certified
  // binding to a signed executable, deployed runtime or provider receipt.
  const cross = m.evidence.cross_repository_provenance;
  exactRecord(cross, [
    'source_repository','registry_referenced_commit_sha','scope',
    'verification_status','source_commit_and_tree_verified',
    'executable_build_binding_verified','attestation_verified',
    'runtime_release_digest','signed_provenance_reference',
    'independently_verified_receipts','production_authority',
    'required_independent_evidence','warning'
  ], 'cross repository provenance');
  eq(m.baseline.website_repository, 'jadeldiaz01-png/jadeltechrd.com', 'website repository');
  if (!isSha(m.baseline.website_main_sha_at_review)) fail('website baseline SHA');
  eq(m.baseline.revenue_repository, 'jadeldiaz01-png/ai-income-revenue-engine', 'revenue repository');
  if (!isSha(m.baseline.revenue_evidence_sha_from_registry)) fail('revenue registry SHA');
  eq(cross.source_repository, m.baseline.revenue_repository, 'cross repository identity');
  eq(cross.registry_referenced_commit_sha, m.baseline.revenue_evidence_sha_from_registry, 'cross repo reference SHA');
  eq(cross.scope, 'REGISTRY_COMMIT_REFERENCE_ONLY', 'cross repo reference scope');
  eq(cross.verification_status, 'NOT_CERTIFIED', 'cross repo verification state');
  for (const key of ['source_commit_and_tree_verified', 'executable_build_binding_verified', 'attestation_verified', 'production_authority']) {
    eq(cross[key], false, 'cross repo unverified proof: ' + key);
  }
  for (const key of ['runtime_release_digest','signed_provenance_reference']) eq(cross[key], null, key + ' is not certified');
  if (!Array.isArray(cross.independently_verified_receipts) || cross.independently_verified_receipts.length !== 0) {
    fail('authenticated external receipts not collected');
  }
  exactIds(cross.required_independent_evidence, [
    'authenticated_source_commit_and_tree',
    'pinned_build_materials_and_artifact_digest',
    'verified_signed_slsa_provenance',
    'independent_runtime_artifact_identity',
    'provider_receipts_and_connector_scope'
  ], 'cross repository independent certification requirements');
  if (!nonEmpty(cross.warning) || !cross.warning.includes('not evidence of executable runtime identity')) {
    fail('cross repo limitations absent');
  }
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
  // Both declarations must cite the same registry SHA; neither declaration
  // certifies an external build, release, connector or deployed process.
  eq(readinessSales.primary_repository, m.baseline.revenue_repository, 'readiness source repository');
  eq(readinessSales.source_sha, cross.registry_referenced_commit_sha, 'readiness source SHA reference');
  const revenueRegistryRefs = (registrySales.evidence_repositories || [])
    .filter(x => x.repository === cross.source_repository);
  if (revenueRegistryRefs.length !== 1 || revenueRegistryRefs[0].sha !== cross.registry_referenced_commit_sha) {
    fail('revenue registry cross-repository provenance declaration drift');
  }
  eq(sales.pricing?.setup?.amount_minor, 150000, 'existing setup minimum changed');
  eq(sales.pricing?.monthly?.amount_minor, 29900, 'existing monthly price changed');
  if (readinessSales.service_specific_gates?.crm_or_delivery_connector_verified !== false
      || readinessSales.service_specific_gates?.consent_and_contact_policy_verified !== false
      || readinessSales.service_specific_gates?.identity_and_tos_checks !== false) {
    fail('unverified connectors, consent, or platform eligibility unexpectedly promoted');
  }
  if (!Array.isArray(readinessSales.blocking_gates) || readinessSales.blocking_gates.length < 3) fail('missing production blockers');

  const pinned = new Map(m.evidence.code_observations.map(x => [x.path, x.blob_sha]));
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
