import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const certifier = path.join(repoRoot, 'scripts/certify-site-slo.mjs');
const policy = path.join(repoRoot, 'config/slo-policy.json');
const windowEnd = '2026-09-19';

function dateAdd(date, days) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

function makeSample(date, slot, {siteGood=true,intakeGood=true,siteLatency=100,intakeLatency=150}={}) {
  const totalMinutes = 7 + slot * 10;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2,'0');
  const mm = String(totalMinutes % 60).padStart(2,'0');
  const observedAt = `${date}T${hh}:${mm}:00Z`;
  return {
    observed_at: observedAt,
    workflow_run_id: `${date.replaceAll('-','')}${String(slot).padStart(3,'0')}`,
    workflow_run_attempt: '1',
    source_sha: 'a'.repeat(40),
    public_site: {
      good: siteGood,
      semantic_ok: siteGood,
      transport_ok: siteGood,
      http_code: siteGood ? '200' : '503',
      latency_ms: siteLatency
    },
    commercial_intake: {
      good: intakeGood,
      semantic_ok: intakeGood,
      transport_ok: intakeGood,
      http_code: intakeGood ? '200' : '503',
      latency_ms: intakeLatency
    }
  };
}

function buildFixture(root, mutate) {
  const dailyDir = path.join(root,'daily');
  const alertDir = path.join(root,'alert');
  fs.mkdirSync(dailyDir,{recursive:true});
  fs.mkdirSync(alertDir,{recursive:true});
  const start=dateAdd(windowEnd,-29);
  for(let d=0; d<30; d++){
    const date=dateAdd(start,d);
    const samples=Array.from({length:144},(_,slot)=>makeSample(date,slot));
    const summary={
      schema_version:'1.0',
      control_id:'SITE_SLO_DAILY_ROLLUP',
      target_date:date,
      generated_at:`${date}T23:59:59Z`,
      expected_slots:144,
      scheduled_sample_count:144,
      coverage_ratio:1,
      maximum_gap_minutes:10,
      samples
    };
    fs.mkdirSync(path.join(dailyDir,date),{recursive:true});
    fs.writeFileSync(path.join(dailyDir,date,'slo-daily-summary.json'),JSON.stringify(summary));
  }
  const alert={
    schema_version:'1.0',
    control_id:'SLO_ALERT_DELIVERY',
    status:'PASS',
    channel:'github_issue',
    workflow_run_id:'123456',
    observed_at:'2026-09-20T01:00:00Z',
    round_trip:{create:true,read:true,comment:true,close:true},
    outage_declared:false
  };
  fs.writeFileSync(path.join(alertDir,'slo-alert-path-evidence.json'),JSON.stringify(alert));
  if (mutate) mutate({dailyDir,alertDir,start});
  return {dailyDir,alertDir};
}

function runCase(name, mutate, expectedStatus) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`slo-${name}-`));
  try {
    const {dailyDir,alertDir}=buildFixture(root,mutate);
    const output=path.join(root,'result.json');
    const proc=spawnSync(process.execPath,[certifier],{
      cwd:repoRoot,
      env:{...process.env,SLO_DAILY_DIR:dailyDir,SLO_ALERT_DIR:alertDir,SLO_POLICY:policy,SLO_OUTPUT:output,SLO_WINDOW_END_DATE:windowEnd,SLO_CERTIFICATION_NOW:'2026-09-20T04:00:00Z'},
      encoding:'utf8'
    });
    if(proc.status!==0) throw new Error(`${name}: certifier process failed\n${proc.stdout}\n${proc.stderr}`);
    const result=JSON.parse(fs.readFileSync(output,'utf8'));
    if(result.status!==expectedStatus) throw new Error(`${name}: expected ${expectedStatus}, got ${result.status}`);
    console.log(`SLO_CERTIFIER_FIXTURE=${name} status=${result.status} PASS`);
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
}

runCase('perfect',null,'PASS');

runCase('blind-gap',({dailyDir,start})=>{
  const missing=dateAdd(start,12);
  fs.rmSync(path.join(dailyDir,missing),{recursive:true,force:true});
},'NOT_YET_CERTIFIED');

runCase('error-budget',({dailyDir,start})=>{
  const date=dateAdd(start,29);
  const file=path.join(dailyDir,date,'slo-daily-summary.json');
  const d=JSON.parse(fs.readFileSync(file,'utf8'));
  for(let i=0;i<12;i++){
    d.samples[i].public_site.good=false;
    d.samples[i].public_site.transport_ok=false;
    d.samples[i].public_site.semantic_ok=false;
    d.samples[i].public_site.http_code='503';
  }
  fs.writeFileSync(file,JSON.stringify(d));
},'NOT_YET_CERTIFIED');

runCase('historical-spike-cleared',({dailyDir,start})=>{
  const date=dateAdd(start,29);
  const file=path.join(dailyDir,date,'slo-daily-summary.json');
  const d=JSON.parse(fs.readFileSync(file,'utf8'));
  const sample=d.samples[102];
  sample.public_site.good=false;
  sample.public_site.transport_ok=false;
  sample.public_site.semantic_ok=false;
  sample.public_site.http_code='503';
  fs.writeFileSync(file,JSON.stringify(d));
},'PASS');

runCase('active-fast-burn',({dailyDir,start})=>{
  const date=dateAdd(start,29);
  const file=path.join(dailyDir,date,'slo-daily-summary.json');
  const d=JSON.parse(fs.readFileSync(file,'utf8'));
  const sample=d.samples[143];
  sample.public_site.good=false;
  sample.public_site.transport_ok=false;
  sample.public_site.semantic_ok=false;
  sample.public_site.http_code='503';
  fs.writeFileSync(file,JSON.stringify(d));
},'NOT_YET_CERTIFIED');

runCase('stale-alert',({alertDir})=>{
  const file=path.join(alertDir,'slo-alert-path-evidence.json');
  const a=JSON.parse(fs.readFileSync(file,'utf8'));
  a.observed_at='2026-08-01T00:00:00Z';
  fs.writeFileSync(file,JSON.stringify(a));
},'NOT_YET_CERTIFIED');
