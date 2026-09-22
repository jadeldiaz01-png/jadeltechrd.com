import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const target='2026-09-22';
const script=path.resolve('scripts/build-site-slo-daily-rollup.mjs');
function probe({at,provider,event='schedule',good=true,id}) {
  return {schema_version:'2.1',observed_at:at,provider_id:provider,event_name:event,workflow_run_id:id,workflow_run_attempt:'1',source_sha:'test',probes:{
    public_site:{good,semantic_ok:good,transport_ok:true,http_code:'200',latency_ms:100},
    commercial_intake:{good,semantic_ok:good,transport_ok:true,http_code:'200',latency_ms:80}
  }};
}
function run(samples) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slo-test-'));
  samples.forEach((s,i)=>{const p=path.join(dir,String(i));fs.mkdirSync(p);fs.writeFileSync(path.join(p,'slo-probe.json'),JSON.stringify(s));});
  const out=path.join(dir,'out.json');
  const r=spawnSync(process.execPath,[script],{cwd:process.cwd(),env:{...process.env,SLO_PROBE_DIR:dir,SLO_TARGET_DATE:target,SLO_OUTPUT:out},encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  return JSON.parse(fs.readFileSync(out,'utf8'));
}
const github=run([probe({at:target+'T10:07:00Z',provider:'github_actions',id:'g1'})]);
const external=run([probe({at:target+'T10:07:00Z',provider:'external_watchdog',event:'workflow_dispatch',id:'e1'})]);
assert.equal(github.scheduled_sample_count,1);
assert.equal(external.scheduled_sample_count,1);
assert.equal(github.coverage_ratio,external.coverage_ratio);
assert.equal(github.maximum_gap_minutes,external.maximum_gap_minutes);
assert.deepEqual(github.services,external.services);

const dedup=run([
 probe({at:target+'T10:07:00Z',provider:'github_actions',id:'g1'}),
 probe({at:target+'T10:08:00Z',provider:'external_watchdog',event:'workflow_dispatch',id:'e1'})
]);
assert.equal(dedup.scheduled_sample_count,1);
assert.equal(dedup.duplicate_authorized_samples,1);
assert.equal(dedup.coverage_ratio,1/144);

const failClosed=run([
 probe({at:target+'T10:07:00Z',provider:'github_actions',id:'g1',good:true}),
 probe({at:target+'T10:08:00Z',provider:'external_watchdog',event:'workflow_dispatch',id:'e1',good:false})
]);
assert.equal(failClosed.scheduled_sample_count,1);
assert.equal(failClosed.services.public_site.bad,1);
assert.equal(failClosed.services.commercial_intake_health.bad,1);

const manual=run([probe({at:target+'T10:07:00Z',provider:'diagnostic_manual',event:'workflow_dispatch',id:'m1'})]);
assert.equal(manual.scheduled_sample_count,0);
assert.equal(manual.coverage_ratio,0);
console.log('SLO_PROVIDER_EQUIVALENCE_DEDUP=PASS');
