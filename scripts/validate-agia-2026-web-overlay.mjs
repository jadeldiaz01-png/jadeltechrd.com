import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only: never deploys, mutates external state or grants production authority.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const p = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT,rel),'utf8'));
const expectedIds = [
  ...Array.from({length:17},(_,i)=>'C'+String(i+1).padStart(2,'0')),
  ...Array.from({length:7},(_,i)=>'W'+String(i+1).padStart(2,'0'))
];
const outOfScopeIds = [
  ...Array.from({length:8},(_,i)=>'T'+String(i+1).padStart(2,'0')),
  'S01','S02'
];
export function evaluate(overlay,site,institutional,slo) {
 const errors=[];
 const require=(condition,reason)=>{if(!condition) errors.push(reason)};
 const o=overlay||{},d=o.decision||{},a=o.authority||{},snap=o.audit_snapshot||{},w=o.web_slo||{};
 require(o.schema_version==='1.0.0' && o.scope==='web' && o.repository==='jadeldiaz01-png/jadeltechrd.com','overlay_identity_invalid');
 require(/^([a-f0-9]{40})$/.test(snap.main_sha||'') && snap.protected_observed===true,'baseline_snapshot_invalid');
 for(const key of ['production_ready','production_authorized','financial_execution_authorized','external_publication_authorized','live_trading_authorized','execution_enabled_by_default'])require(d[key]===false,'unsafe_'+key);
 for(const key of ['max_autonomous_capital_usd','max_unapproved_spend_usd'])require(d[key]===0,'unsafe_'+key);
 require(d.state==='NO_GO' && d.fail_closed===true,'unsafe_decision');
 for(const key of ['overlay_is_not_a_certifier','required_external_attestations','requires_independent_review','requires_specific_human_merge_approval','requires_specific_human_deploy_approval'])require(a[key]===true,'unsafe_authority_'+key);
 const expectedFiles=['config/institutional-production-manifest-2026.json','config/site-production-readiness-2026.json','config/slo-policy.json'];
 require(JSON.stringify(a.system_of_record)===JSON.stringify(expectedFiles),'canonical_files_modified');
 const expectedCatalog=[...expectedIds,...outOfScopeIds];
 require(Array.isArray(o.catalog) && o.catalog.length===34 && new Set(o.catalog.map(x=>x.id)).size===34 && expectedCatalog.every(id=>o.catalog.some(x=>x.id===id)),'catalog_incomplete_or_duplicate');
 require(JSON.stringify(o.out_of_scope_control_ids)===JSON.stringify(outOfScopeIds),'out_of_scope_boundary_modified');
 require(Array.isArray(o.web_controls) && o.web_controls.length===24 && new Set(o.web_controls.map(x=>x.id)).size===24 && expectedIds.every(id=>o.web_controls.some(x=>x.id===id)),'web_controls_incomplete_or_duplicate');
 for(const gate of o.web_controls||[]){
   require(gate.status==='NOT_YET_CERTIFIED','unaudited_pass_or_invalid_status_'+gate.id);
   require(Array.isArray(gate.evidence) && gate.evidence.length===0,'unverified_evidence_claim_'+gate.id);
 }
 require(w.window_days===30 && w.interval_minutes===10 && w.expected_slots===4320 && w.minimum_valid_slots===4104 && w.minimum_coverage_ratio===0.95 && w.maximum_gap_minutes===30,'overlay_slo_threshold_weakened');
 const legacy=site||{}, inst=institutional||{},policy=slo||{},publicSlo=policy.public_domain_certification||{};
 require(legacy.decision?.production_authorized===false && legacy.decision?.fail_closed===true && legacy.decision?.execution_enabled_by_default===false,'site_authority_not_fail_closed');
 require(inst.decision?.institutional_production_authorized===false && inst.decision?.fail_closed===true && inst.decision?.execution_enabled_by_default===false,'institutional_authority_not_fail_closed');
 require(publicSlo.measurement_window_days===30 && publicSlo.probe_interval_minutes===10 && publicSlo.expected_slots_per_window===4320 && publicSlo.minimum_coverage_ratio>=0.95 && publicSlo.maximum_gap_minutes<=30,'canonical_slo_policy_weakened');
 require(publicSlo.availability_objectives?.['public-site']>=0.999 && publicSlo.availability_objectives?.['commercial-intake-health']>=0.995,'canonical_availability_weakened');
 require(legacy.production_gates?.some(x=>x.id==='SLO_ERROR_BUDGET_ALERTING'),'canonical_slo_gate_missing');
 require(legacy.production_gates?.some(x=>x.id==='PRODUCTION_DOMAIN_GATE'),'canonical_final_gate_missing');
 return {overlay_valid:errors.length===0,decision:'NO_GO',effective_promotion_authority:'NONE',errors,
 web_controls_pending:expectedIds.length,non_web_controls_out_of_scope:outOfScopeIds.length,
 historical_site_slo_status:legacy.production_gates?.find(x=>x.id==='SLO_ERROR_BUDGET_ALERTING')?.status||'UNKNOWN'};
}
export function verifyFiles(){
 return evaluate(
 p('config/agia-2026-web-overlay.json'),
 p('config/site-production-readiness-2026.json'),
 p('config/institutional-production-manifest-2026.json'),
 p('config/slo-policy.json')
 );
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try {
  const result=verifyFiles();
  console.log(JSON.stringify(result,null,2));
  if(!result.overlay_valid)process.exitCode=2;
 }catch(e){
  console.error('AGIA_WEB_OVERLAY_VALIDATION=FAIL '+e.constructor.name);
  process.exitCode=2;
 }
}
