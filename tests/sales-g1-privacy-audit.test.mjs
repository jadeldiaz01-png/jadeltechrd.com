import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateG1,verifyReadOnlySnapshot} from '../scripts/validate-sales-g1-privacy-audit.mjs';

const audit=JSON.parse(fs.readFileSync('config/sales-g1-privacy-audit-2026.json','utf8'));
const check=(a)=>validateG1(a);
test('source evidence and G1 fail-closed snapshot match exact Git blobs',()=>assert.equal(verifyReadOnlySnapshot(),true));
test('valid G1 evidence contract remains blocked',()=>assert.equal(check(audit),true));
const tamper=[
['fake G1 production-ready',a=>{a.overall_decision='PASS';}],
['false certification status',a=>{a.certification_status='CERTIFIED';}],
['unauthorized outbound',a=>{a.marketing_or_outbound_enabled=true;}],
['CRM authority escalation',a=>{a.crm_or_email_connector_authorized=true;}],
['fabricated access to subject records',a=>{a.subject_data_access_performed=true;}],
['fabricated provider operations',a=>{a.external_provider_actions_performed=true;}],
['false marketing form opt-in',a=>{a.marketing_policy.form_consent_is_marketing_opt_in=true;}],
['false analytics marketing opt-in',a=>{a.marketing_policy.analytics_consent_is_marketing_opt_in=true;}],
['unapproved retention period',a=>{a.data_retentions.duration_days=365;}],
['fabricated retention policy approval',a=>{a.data_retentions.approved_schedule_exists=true;}],
['pretend retention job certified',a=>{a.data_retentions.retention_job_certified=true;}],
['remove blocked consent gap',a=>{a.findings=a.findings.filter(x=>x.id!=='G1-P1-CONSENT-RECEIPT');}],
['remove suppression gap',a=>{a.findings=a.findings.filter(x=>x.id!=='G1-P1-SUPPRESSION');}],
['duplicate DSAR finding ID',a=>{a.findings[2].id=a.findings[1].id;}],
['downgrade consent finding severity',a=>{a.findings[0].severity='LOW';}],
['fake consent receipt completed',a=>{a.findings[0].state='CERTIFIED';}],
['omit request receipt proof',a=>{a.findings[0].required.pop();}],
['omit explicit marketing suppression proof',a=>{a.findings[1].required.shift();}],
['claim GDPR legal implementation certified',a=>{a.legal_references[2].implementation_certified=true;}],
['substitute Dominican anti-spam law URL',a=>{a.legal_references[1].source_url='https://example.test/spam';}],
['drop Dominican 310-14',a=>{a.legal_references=a.legal_references.filter(x=>x.id!=='RD-310-14');}],
['duplicate source evidence',a=>{a.audited_corpus.files.push({...a.audited_corpus.files[0]});}],
['remove original lead source evidence',a=>{a.audited_corpus.files=a.audited_corpus.files.filter(x=>x.id!=='lead_schema');}],
['substitute audited source SHA',a=>{a.audited_corpus.files[0].blob_sha='f'.repeat(40);}],
['swap observation/path relationship',a=>{a.audited_corpus.files[0].path='project-request.js';}],
['fabricate an observed consent receipt',a=>{a.audited_corpus.files[1].observation='SERVER_CONSENT_VERIFIED';}],
['change approved scope',a=>{a.allowed_mode='PRODUCTION';}],
['omit promotion gate legal review',a=>{a.privacy_promotion_requirements.shift();}],
['invent completed provider receipts',a=>{a.marketing_policy.real_outreach_certified=true;}],
['add arbitrary admin authority field',a=>{a.marketing_policy.override_admin=true;}],
['hide reviewed main baseline',a=>{a.reviewed_main_sha='0'.repeat(40);}]
];
for(const [name,mutate] of tamper) {
  test('fail-closed G1 negative: '+name,()=>{
    const a=structuredClone(audit);
    mutate(a);
    assert.throws(()=>check(a),/SALES_G1_PRIVACY_FAIL/);
  });
}
test('rejects payload beginning to report privacy proof without re-audit',()=>{
  const contents=Object.fromEntries(audit.audited_corpus.files.map(x=>[x.path,fs.readFileSync(x.path,'utf8')]));
  contents['project-request.js']=contents['project-request.js'].replace(
    '    locale: document.documentElement.lang || "es-DO",',
    '    locale: document.documentElement.lang || "es-DO",\n    consent: true,'
  );
  assert.throws(()=>validateG1(audit,{sourceContents:contents}),/SALES_G1_PRIVACY_FAIL/);
});
test('rejects API allowlist changing without versioned evidence review',()=>{
  const contents=Object.fromEntries(audit.audited_corpus.files.map(x=>[x.path,fs.readFileSync(x.path,'utf8')]));
  contents['commercial-runtime/src/validation.mjs']=contents['commercial-runtime/src/validation.mjs'].replace(
    '"offer_id","utm_source"',
    '"privacy_notice_version","offer_id","utm_source"'
  );
  assert.throws(()=>validateG1(audit,{sourceContents:contents}),/SALES_G1_PRIVACY_FAIL/);
});
