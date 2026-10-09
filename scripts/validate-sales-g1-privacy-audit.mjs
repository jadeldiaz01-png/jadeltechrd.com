import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const AUDIT_PATH = 'config/sales-g1-privacy-audit-2026.json';
const SALES_PATH = 'config/sales-lead-intelligence-production-readiness-2026.json';
const fail = (x) => { throw new Error('SALES_G1_PRIVACY_FAIL ' + x); };
const eq = (v, e, name) => { if (v !== e) fail(name); };
const exact = (actual, expected, name) => {
  if (!Array.isArray(actual) || actual.length !== expected.length ||
      new Set(actual).size !== expected.length ||
      !expected.every(x => actual.includes(x))) fail(name + ': inventory mismatch');
};
const SHA = /^[a-f0-9]{40}$/;
const expectedObservations = Object.freeze({
  public_intake_form:['solicitar-proyecto.html','436fb899f411f2c67a9152243fc9650aeeb75f7b','PRIVACY_NOTICE_CHECKBOX_PRESENT'],
  browser_payload:['project-request.js','cc666e42ef3cec905efdbac6e1c1ae5e1def5c33','NO_CONSENT_EVIDENCE_IN_JSON_PAYLOAD'],
  server_validation:['commercial-runtime/src/validation.mjs','37b63fecebd2f5e09f7651b90063f701b580aa58','NO_PURPOSE_OR_CONSENT_PROOF_FIELD'],
  server_persistence:['commercial-runtime/src/worker.mjs','6e5e501b17601a654c5e3a003cdaae41af3b8e71','REQUEST_PERSISTED_WITHOUT_CONSENT_RECEIPT'],
  intake_schema:['commercial-runtime/migrations/0001_init.sql','9db8b4e1169c236af868998843368a5fe0bfaa8b','PII_STORED_WITHOUT_DEDICATED_CONSENT_AUDIT_COLUMN'],
  lead_schema:['commercial-runtime/migrations/0004_revenue_intelligence.sql','cea3dd7f63a78454230061e937010b59bf963514','LEAD_SOURCE_ENUM_NOT_LAWFUL_COLLECTION_PROOF'],
  retention_schema:['commercial-runtime/migrations/0007_offer_attribution.sql','4be100d3764e94fafb8d325c33a3dd1f08824069','ATTRIBUTION_COLUMNS_ONLY_NO_RETENTION'],
  privacy_notice:['index.html','abd83fbf3fb46710af91c15459223954a2fcbdfa','PRIVACY_NOTICE_STATIC_DELETION_ROUTE_DYNAMIC'],
  privacy_deletion_renderer:['app.js','f3243c64b50bae5713e62e2da6ff926ca20cd201','PUBLIC_DELETION_ARTICLE_GENERATED_BY_APP_JS'],
  analytics_consent:['analytics-consent.js','c3902f0dca45d969458bce916185060885808233','SEPARATE_ANALYTICS_CONSENT_NOT_MARKETING'],
  sales_policy:['config/sales-lead-intelligence-production-readiness-2026.json','cd07982b25537a6f156b607ce730433aeecb34db','G1_PREEXISTING_BLOCKED']
});
const reqFindings = Object.freeze({
  'G1-P1-CONSENT-RECEIPT':[
    'privacy_notice_version_hash','server_validated_purpose_evidence','atomic_consent_event_at_submission','negative_replay_without_proof','privacy_response_vs_marketing_separation'],
  'G1-P1-SUPPRESSION':[
    'tenant_scoped_suppression_store','idempotent_objection_intake','suppression_checks_at_decision_and_send','hard_stop_on_unknown_or_revoked','provider_revocation_reconciliation'],
  'G1-P1-DSAR':[
    'identity_verification','request_tracking','legal_hold_exceptions','cascade_to_derived_data','backup_tombstones','verified_dsar_e2e'],
  'G1-P1-RETENTION':[
    'lawyer_reviewed_retention_schedule','per_purpose_expiry','job_disabled_until_authorized','purge_dry_run','restore_without_resurrection','retention_e2e'],
  'G1-P1-PROVENANCE':[
    'per_lead_source_license_or_first_party_receipt','lawful_basis_and_jurisdiction','source_observed_at','notice_id_and_version','provider_terms_proof','lineage_and_change_history'],
  'G1-P1-LEGAL':[
    'RD_172_13_scope_and_exemptions','RD_310_14_sender_and_opt_out_duties','EU_GDPR_ePrivacy_if_applicable','US_CAN_SPAM_if_applicable','controller_processor_roles','cross_border_processing_mapping']
});
const legal = Object.freeze({
  'RD-172-13':'https://sb.gob.do/media/4i1ploou/ley17213.pdf',
  'RD-310-14':'https://justicia.gob.do/wp-content/uploads/2025/10/ley-310-14-2.pdf',
  'EU-GDPR-ART21':'https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en',
  'US-CAN-SPAM':'https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business'
});
const promotions=[
  'independently_reviewed_legal_matrix','server_side_purpose_and_consent_receipt_e2e',
  'real_persisted_source_and_lineage_evidence','dsar_and_suppression_end_to_end_tests',
  'retention_and_backup_purge_drill','per_tenant_authz_and_dpia_if_applicable',
  'approved_production_runtime_monitoring','separate_human_privacy_gate_authorization'
];
function requireShape(x,keys,label) {
  if (!x || typeof x!=='object' || Array.isArray(x) ||
      Object.keys(x).length!==keys.length || !keys.every(k=>Object.hasOwn(x,k))) fail(label+': invalid shape');
}
function read(path) { return fs.readFileSync(path,'utf8'); }
function assertSourceSemantics(corpus) {
  const form=corpus['solicitar-proyecto.html'];
  const client=corpus['project-request.js'];
  const validator=corpus['commercial-runtime/src/validation.mjs'];
  const worker=corpus['commercial-runtime/src/worker.mjs'];
  const sql=corpus['commercial-runtime/migrations/0001_init.sql'];
  const leads=corpus['commercial-runtime/migrations/0004_revenue_intelligence.sql'];
  const landing=corpus['index.html'];
  const privacyRenderer=corpus['app.js'];
  const analytics=corpus['analytics-consent.js'];
  const sales=JSON.parse(corpus[SALES_PATH]);
  if (!/id="privacy-consent"[^>]*type="checkbox"[^>]*required/.test(form)) fail('consent checkbox UI no longer matches inspected state');
  const payload=client.split('function payloadFromForm()')[1]?.split('form?.addEventListener("change"')[0];
  if (!payload || !/new FormData\(form\)/.test(payload) || /\b(consent|privacy|purpose)\b/i.test(payload)) fail('browser intake consent observations changed');
  const fieldList=validator.split('const ALLOWED_FIELDS')[1]?.split(']);')[0];
  if (!fieldList || !fieldList.includes('"turnstile_token"') || /consent|privacy_notice|purpose_receipt/i.test(fieldList)) fail('API allowlist consent observations changed');
  if (!/INSERT INTO project_requests/.test(worker) || !/validateProjectRequest\(await readJsonWithLimit\(request\)\)/.test(worker)) fail('worker intake contract changed');
  if (/consent|privacy_notice|purpose_receipt/i.test(worker.split('const INSERT_REQUEST_SQL')[1]?.split('const INSERT_EVIDENCE_SQL')[0] || '')) fail('worker insert consent proof status changed');
  if (!/CREATE TABLE IF NOT EXISTS project_requests/.test(sql) || !/email TEXT NOT NULL/.test(sql)) fail('stored PII inventory changed');
  if (/consent|privacy_notice|legal_basis|retention_class/i.test(sql)) fail('intake table privacy columns changed');
  if (!/source IN \('human','crm','verified_import'\)/.test(leads)) fail('lead source schema changed');
  if (!/data-view="privacy"/.test(landing) || !/href="\/\?view=data-deletion"/.test(landing) ||
      !/article\.dataset\.view\s*=\s*"data-deletion"/.test(privacyRenderer)) {
    fail('public privacy/deletion rights route changed');
  }
  if (!/jadel\.analytics_consent\.v1/.test(analytics)) fail('analytics consent baseline changed');
  if (sales.gates?.G1_data_privacy?.status!=='BLOCKED' || sales.claim?.production_authorized!==false) fail('sales policy G1/promotions changed');
}

export function validateG1(a,{verifyLocalBlobs=false,sourceContents=null}={}) {
  eq(a.schema_version,'2026-10-08.g1.audit.v1','audit version');
  eq(a.audit_id,'SALES-G1-PRIVACY-READONLY','audit identity');
  eq(a.service,'sales','service identity');
  eq(a.reviewed_main_sha,'b66c547c9df44421679021b4d74c328d1cb84ae5','review snapshot');
  eq(a.review_type,'SOURCE_CODE_OBSERVATION_NO_PERSONAL_DATA_ACCESS','scope');
  eq(a.overall_decision,'BLOCKED','G1 must remain blocked');
  eq(a.certification_status,'NOT_CERTIFIED','certification must not be claimed');
  eq(a.allowed_mode,'DOCUMENT_ONLY_READ_ONLY','allowed audit mode');
  for (const k of ['production_authorized','marketing_or_outbound_enabled','crm_or_email_connector_authorized',
                   'subject_data_access_performed','external_provider_actions_performed','financial_execution_enabled']) eq(a[k],false,k);
  const corpus=a.audited_corpus;
  requireShape(corpus,['repository','commit_sha','files'],'source corpus');
  eq(corpus.repository,'jadeldiaz01-png/jadeltechrd.com','corpus repository');
  eq(corpus.commit_sha,a.reviewed_main_sha,'corpus reviewed commit');
  exact(corpus.files?.map(x=>x?.id),Object.keys(expectedObservations),'observed file ids');
  exact(corpus.files?.map(x=>x?.path),Object.values(expectedObservations).map(x=>x[0]),'observed file paths');
  for(const x of corpus.files) {
    requireShape(x,['id','path','blob_sha','observation'],'code evidence');
    const wanted=expectedObservations[x.id];
    if(!wanted)fail('unknown code observation');
    eq(x.path,wanted[0],'observed path/id');
    eq(x.blob_sha,wanted[1],'observed blob/id');
    eq(x.observation,wanted[2],'observed fact/id');
    if(!SHA.test(x.blob_sha)) fail('invalid reviewed Git blob');
    if(verifyLocalBlobs) {
      const actual=execFileSync('git',['hash-object',x.path],{encoding:'utf8'}).trim();
      eq(actual,x.blob_sha,'source blob drift: '+x.path);
    }
  }
  requireShape(a.purpose_separation,['inbound_request_response','marketing_prospecting','analytics','operational_privacy_evidence'],'purpose policy');
  eq(a.purpose_separation.marketing_prospecting,'NOT_AUTHORIZED_BY_FORM_CHECKBOX','marketing purpose unauthorized');
  eq(a.purpose_separation.operational_privacy_evidence,'NO_SERVER_SIDE_CONSENT_RECEIPT_IN_INSPECTED_FLOW','consent proof not verified');
  exact(a.findings?.map(x=>x?.id),Object.keys(reqFindings),'risk findings');
  for(const f of a.findings) {
    requireShape(f,['id','severity','state','description','required'],'privacy finding');
    eq(f.severity,'HIGH','risk cannot be understated: '+f.id);
    eq(f.state,f.id==='G1-P1-CONSENT-RECEIPT'?'CONFIRMED_CODE_GAP':f.id==='G1-P1-LEGAL'?'PENDING_HUMAN_LEGAL_REVIEW':'EVIDENCE_MISSING','finding state');
    if(typeof f.description!=='string' || f.description.length<40)fail('missing finding description');
    exact(f.required,reqFindings[f.id],'required privacy evidence for '+f.id);
  }
  exact(a.legal_references?.map(x=>x?.id),Object.keys(legal),'legal references');
  for(const l of a.legal_references) {
    requireShape(l,['id','jurisdiction','source_url','focus','verified_in_public_primary_source','implementation_certified'],'legal source');
    eq(l.source_url,legal[l.id],'legal source URL');
    eq(l.verified_in_public_primary_source,true,'legal source inspected');
    eq(l.implementation_certified,false,'legal implementation cannot be claimed');
  }
  requireShape(a.data_retentions,['approved_schedule_exists','duration_days','retention_job_certified','legal_hold_policy_certified'],'retention');
  eq(a.data_retentions.approved_schedule_exists,false,'missing retention approval');
  eq(a.data_retentions.duration_days,null,'no invented period');
  eq(a.data_retentions.retention_job_certified,false,'retention jobs');
  eq(a.data_retentions.legal_hold_policy_certified,false,'legal hold');
  requireShape(a.marketing_policy,['default_deny','form_consent_is_marketing_opt_in','analytics_consent_is_marketing_opt_in','provider_scope_selected','real_outreach_certified'],'marketing');
  eq(a.marketing_policy.default_deny,true,'marketing default deny');
  for(const k of ['form_consent_is_marketing_opt_in','analytics_consent_is_marketing_opt_in','provider_scope_selected','real_outreach_certified'])eq(a.marketing_policy[k],false,k);
  exact(a.privacy_promotion_requirements,promotions,'G1 promotion proof');
  if(!Array.isArray(a.evidence_not_collected)||a.evidence_not_collected.length!==6)fail('missing evidence categories');
  if(!Array.isArray(a.review_caveats)||a.review_caveats.length<5)fail('unknown source limits');
  if(sourceContents)assertSourceSemantics(sourceContents);
  return true;
}
export function verifyReadOnlySnapshot() {
  const a=JSON.parse(read(AUDIT_PATH));
  const corpus=Object.fromEntries(a.audited_corpus.files.map(x=>[x.path,read(x.path)]));
  return validateG1(a,{verifyLocalBlobs:true,sourceContents:corpus});
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{verifyReadOnlySnapshot();console.log('SALES_G1_AUDIT=PASS evidence_inventory_consistent=true certification=BLOCKED no_live_data_access=true');}
  catch(e){console.error(e.message);process.exitCode=1;}
}
