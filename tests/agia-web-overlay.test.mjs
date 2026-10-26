import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluate,verifyFiles} from '../scripts/validate-agia-2026-web-overlay.mjs';
const json=(x)=>JSON.parse(readFileSync(new URL('../'+x,import.meta.url),'utf8'));
const base=[
 json('config/agia-2026-web-overlay.json'),
 json('config/site-production-readiness-2026.json'),
 json('config/institutional-production-manifest-2026.json'),
 json('config/slo-policy.json')
];
const check=(mutation)=>{const [a,b,c,d]=structuredClone(base);mutation(a,b,c,d);return evaluate(a,b,c,d)};
test('validated baseline is NO_GO',()=>{
 const x=verifyFiles();assert.equal(x.overlay_valid,true);assert.equal(x.decision,'NO_GO');assert.equal(x.web_controls_pending,24);assert.equal(x.non_web_controls_out_of_scope,10);
});
test('reject unsafe production promotion',()=>{assert.ok(check(a=>a.decision.production_authorized=true).errors.includes('unsafe_production_authorized'));});
test('reject spoofed production ready state',()=>{assert.ok(check(a=>a.decision.production_ready=true).errors.includes('unsafe_production_ready'));});
test('reject live trading and capital',()=>{assert.equal(check(a=>{a.decision.live_trading_authorized=true;a.decision.max_autonomous_capital_usd=1}).overlay_valid,false);});
test('reject spend or publication',()=>{assert.equal(check(a=>{a.decision.max_unapproved_spend_usd=10;a.decision.external_publication_authorized=true}).overlay_valid,false);});
test('reject invented PASS',()=>{assert.ok(check(a=>a.web_controls[0].status='PASS').errors.some(s=>s.includes('unaudited_pass')));});
test('reject evidence without external verification',()=>{assert.ok(check(a=>a.web_controls[0].evidence.push({assertion:'PASS'})).errors.some(s=>s.includes('unverified_evidence_claim')));});
test('reject missing controls',()=>{assert.ok(check(a=>a.web_controls.pop()).errors.includes('web_controls_incomplete_or_duplicate'));});
test('reject duplicate controls',()=>{assert.ok(check(a=>a.web_controls[1].id='C01').errors.includes('web_controls_incomplete_or_duplicate'));});
test('reject altered catalogue',()=>{assert.ok(check(a=>a.catalog.pop()).errors.includes('catalog_incomplete_or_duplicate'));});
test('reject scope boundary',()=>{assert.ok(check(a=>a.out_of_scope_control_ids.push('W01')).errors.includes('out_of_scope_boundary_modified'));});
test('reject weaker web SLO requirement',()=>{assert.ok(check(a=>a.web_slo.minimum_valid_slots=100).errors.includes('overlay_slo_threshold_weakened'));});
test('reject weaker canonical SLO requirement',()=>{assert.ok(check((a,b,c,d)=>d.public_domain_certification.maximum_gap_minutes=90).errors.includes('canonical_slo_policy_weakened'));});
test('reject weaker canonical availability',()=>{assert.ok(check((a,b,c,d)=>d.public_domain_certification.availability_objectives['public-site']=0.9).errors.includes('canonical_availability_weakened'));});
test('reject promotion in site manifest without overlay review',()=>{assert.ok(check((a,b)=>b.decision.production_authorized=true).errors.includes('site_authority_not_fail_closed'));});
test('reject promotion in institutional manifest without overlay review',()=>{assert.ok(check((a,b,c)=>c.decision.institutional_production_authorized=true).errors.includes('institutional_authority_not_fail_closed'));});
test('reject removed human gates',()=>{assert.equal(check(a=>a.authority.requires_independent_review=false).overlay_valid,false);});
test('reject altered source-of-truth',()=>{assert.equal(check(a=>a.authority.system_of_record.pop()).overlay_valid,false);});
