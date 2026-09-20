import fs from 'node:fs';
import path from 'node:path';

const dailyDir = process.env.SLO_DAILY_DIR || 'slo-daily';
const alertDir = process.env.SLO_ALERT_DIR || 'slo-alert';
const policyPath = process.env.SLO_POLICY || 'config/slo-policy.json';
const outputPath = process.env.SLO_OUTPUT || 'evidence/slo-30d-certification.json';
const certificationNow = process.env.SLO_CERTIFICATION_NOW || new Date().toISOString();
const certificationNowMs = Date.parse(certificationNow);
if (!Number.isFinite(certificationNowMs)) throw new Error('SLO_CERTIFICATION_NOW is invalid');
const windowEndDate = process.env.SLO_WINDOW_END_DATE || new Date(certificationNowMs - 86400000).toISOString().slice(0,10);

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const cert = policy.public_domain_certification;
if (!cert) throw new Error('public_domain_certification policy missing');

function walk(dir, basename) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, basename));
    else if (entry.isFile() && entry.name === basename) out.push(p);
  }
  return out;
}

function dateAdd(date, days) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

const days = cert.measurement_window_days;
const windowStartDate = dateAdd(windowEndDate, -(days - 1));
const windowStartMs = Date.parse(windowStartDate + 'T00:00:00Z');
const windowEndExclusiveMs = Date.parse(dateAdd(windowEndDate, 1) + 'T00:00:00Z');

const dailyByDate = new Map();
for (const file of walk(dailyDir, 'slo-daily-summary.json')) {
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.target_date ?? '')) continue;
    const prev = dailyByDate.get(d.target_date);
    if (!prev || Date.parse(d.generated_at ?? 0) >= Date.parse(prev.generated_at ?? 0)) dailyByDate.set(d.target_date, d);
  } catch {
    // Invalid rollups cannot help certification.
  }
}

const expectedDates = Array.from({length:days}, (_,i)=>dateAdd(windowStartDate,i));
const missingDailyDates = expectedDates.filter(d => !dailyByDate.has(d));
const samples = [];
for (const date of expectedDates) {
  const d = dailyByDate.get(date);
  if (!d || !Array.isArray(d.samples)) continue;
  for (const s of d.samples) {
    const t = Date.parse(s.observed_at);
    if (Number.isFinite(t) && t >= windowStartMs && t < windowEndExclusiveMs) samples.push(s);
  }
}
samples.sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));

const expectedSlots = cert.expected_slots_per_window;
const coverageRatio = samples.length / expectedSlots;

function maxGapMinutes(xs) {
  if (!xs.length) return days * 1440;
  let max = (Date.parse(xs[0].observed_at) - windowStartMs) / 60000;
  for (let i=1;i<xs.length;i++) {
    max = Math.max(max,(Date.parse(xs[i].observed_at)-Date.parse(xs[i-1].observed_at))/60000);
  }
  max = Math.max(max,(windowEndExclusiveMs-Date.parse(xs.at(-1).observed_at))/60000);
  return Number(max.toFixed(3));
}

function percentileNearestRank(values, q) {
  const xs = values.filter(Number.isFinite).sort((a,b)=>a-b);
  if (!xs.length) return null;
  const rank = Math.max(1, Math.ceil(q * xs.length));
  return xs[rank - 1];
}

const serviceDefs = {
  public_site: {
    sampleKey:'public_site',
    objective: cert.availability_objectives['public-site'],
    latencyObjective: cert.latency_objectives_ms['public-site-p95']
  },
  commercial_intake_health: {
    sampleKey:'commercial_intake',
    objective: cert.availability_objectives['commercial-intake-health'],
    latencyObjective: cert.latency_objectives_ms['commercial-intake-health-p95']
  }
};

function serviceWindow(xs, def) {
  let good=0, invariantViolations=0;
  const lat=[];
  for (const s of xs) {
    const p=s[def.sampleKey] ?? {};
    if (p.good === true) {
      good++;
      const n=Number(p.latency_ms);
      if (Number.isFinite(n)) lat.push(n);
    }
    if (p.transport_ok === true && String(p.http_code)==='200' && p.semantic_ok !== true) invariantViolations++;
  }
  const observed=xs.length;
  const bad=observed-good;
  const availability=observed ? good/observed : 0;
  const errorFraction=1-availability;
  const allowedErrorFraction=1-def.objective;
  const budgetConsumed=allowedErrorFraction > 0 ? errorFraction/allowedErrorFraction : Infinity;
  const p95=percentileNearestRank(lat,0.95);
  return {
    observed,good,bad,availability,
    objective:def.objective,
    error_fraction:errorFraction,
    error_budget_fraction:allowedErrorFraction,
    error_budget_consumed_ratio:Number.isFinite(budgetConsumed)?budgetConsumed:null,
    error_budget_remaining_ratio:Number.isFinite(budgetConsumed)?1-budgetConsumed:null,
    p95_latency_ms:p95,
    latency_objective_ms:def.latencyObjective,
    hard_invariant_violations:invariantViolations,
    availability_pass:availability>=def.objective,
    latency_pass:p95!==null && p95<=def.latencyObjective,
    hard_invariant_pass:invariantViolations===0
  };
}

const services={};
for (const [name,def] of Object.entries(serviceDefs)) services[name]=serviceWindow(samples,def);

function parseWindowMinutes(value) {
  const match=String(value).match(/^(\d+)(m|h|d)$/);
  if (!match) throw new Error(`invalid burn-rate window: ${value}`);
  const n=Number(match[1]);
  const multiplier=match[2]==='m' ? 1 : match[2]==='h' ? 60 : 1440;
  return n*multiplier;
}

function burnWindow(windowSpec, threshold, minCoverage, def) {
  const minutes=parseWindowMinutes(windowSpec);
  const start=windowEndExclusiveMs-minutes*60000;
  const xs=samples.filter(s=>{const t=Date.parse(s.observed_at); return t>=start && t<windowEndExclusiveMs;});
  const expected=Math.max(1,Math.round(minutes/cert.probe_interval_minutes));
  const coverage=xs.length/expected;
  const sw=serviceWindow(xs,def);
  const burn=sw.error_budget_fraction>0 ? sw.error_fraction/sw.error_budget_fraction : Infinity;
  const evaluable=coverage>=minCoverage;
  return {
    window:windowSpec,minutes,threshold,expected_slots:expected,observed_slots:xs.length,coverage_ratio:coverage,
    burn_rate:Number.isFinite(burn)?burn:null,
    evaluable,
    threshold_exceeded:evaluable && Number.isFinite(burn) && burn>=threshold
  };
}

const burnRules=cert.multiwindow_burn_rate_rules;
if (!Array.isArray(burnRules) || !burnRules.length) throw new Error('multiwindow_burn_rate_rules missing');
const burnRate={};
let burnEvaluationComplete=true;
let burnAlertActive=false;
let burnPageActive=false;
let burnTicketActive=false;
for (const [name,def] of Object.entries(serviceDefs)) {
  burnRate[name]=burnRules.map(rule=>{
    const threshold=Number(rule.threshold);
    const longWindow=burnWindow(rule.long_window,threshold,Number(rule.minimum_long_window_coverage_ratio),def);
    const shortWindow=burnWindow(rule.short_window,threshold,Number(rule.minimum_short_window_coverage_ratio),def);
    const evaluable=longWindow.evaluable && shortWindow.evaluable;
    const active=evaluable && longWindow.threshold_exceeded && shortWindow.threshold_exceeded;
    if (!evaluable) burnEvaluationComplete=false;
    if (active) {
      burnAlertActive=true;
      if (rule.severity==='page') burnPageActive=true;
      if (rule.severity==='ticket') burnTicketActive=true;
    }
    return {
      severity:rule.severity,
      threshold,
      budget_fraction:Number(rule.budget_fraction),
      evaluable,
      active,
      long_window:longWindow,
      short_window:shortWindow
    };
  });
}

let latestAlert=null;
for (const file of walk(alertDir,'slo-alert-path-evidence.json')) {
  try {
    const a=JSON.parse(fs.readFileSync(file,'utf8'));
    if (!latestAlert || Date.parse(a.observed_at??0)>Date.parse(latestAlert.observed_at??0)) latestAlert=a;
  } catch {}
}
let alertAgeDays=null;
let alertDeliveryPass=false;
if (latestAlert?.status==='PASS' && latestAlert?.channel==='github_issue') {
  alertAgeDays=(certificationNowMs-Date.parse(latestAlert.observed_at))/86400000;
  alertDeliveryPass=Number.isFinite(alertAgeDays) && alertAgeDays>=0 && alertAgeDays<=cert.alert_delivery.test_freshness_days;
}

const maxGap=maxGapMinutes(samples);
const coveragePass=coverageRatio>=cert.minimum_coverage_ratio;
const maxGapPass=maxGap<=cert.maximum_gap_minutes;
const servicesPass=Object.values(services).every(s=>s.availability_pass && s.latency_pass && s.hard_invariant_pass && (s.error_budget_remaining_ratio??-1)>=0);
const ready=coveragePass && maxGapPass && servicesPass && burnEvaluationComplete && !burnAlertActive && alertDeliveryPass;

const result={
  schema_version:'1.0',
  control_id:'SLO_ERROR_BUDGET_ALERTING',
  status:ready?'PASS':'NOT_YET_CERTIFIED',
  generated_at:new Date(certificationNowMs).toISOString(),
  window:{start_date:windowStartDate,end_date:windowEndDate,days,expected_slots:expectedSlots},
  evidence_coverage:{
    observed_slots:samples.length,
    coverage_ratio:coverageRatio,
    minimum_coverage_ratio:cert.minimum_coverage_ratio,
    coverage_pass:coveragePass,
    maximum_gap_minutes:maxGap,
    maximum_allowed_gap_minutes:cert.maximum_gap_minutes,
    maximum_gap_pass:maxGapPass,
    missing_daily_rollups:missingDailyDates
  },
  services,
  burn_rate:{
    model:'multiwindow_multi_burn_rate',
    evaluation_complete:burnEvaluationComplete,
    alert_active:burnAlertActive,
    page_active:burnPageActive,
    ticket_active:burnTicketActive,
    rules:burnRate
  },
  alert_delivery:{
    pass:alertDeliveryPass,
    latest_observed_at:latestAlert?.observed_at??null,
    age_days:alertAgeDays,
    required_freshness_days:cert.alert_delivery.test_freshness_days,
    channel:latestAlert?.channel??null,
    evidence_run_id:latestAlert?.workflow_run_id??null
  },
  certification_ready:ready,
  policy_id:policy.policy_id,
  policy_schema_version:policy.schema_version,
  measurement_model:cert.measurement_model,
  notes:[
    'Only scheduled first-attempt samples count toward certification; push/manual probes cannot inflate coverage.',
    'Missing monitor observations are a separate coverage failure and are never counted as healthy service responses.',
    'Public-domain intake health availability is distinct from the higher valid-request acceptance SLO owned by the commercial-intake domain.',
    'Burn-rate activation requires both the long and short windows to exceed the same threshold; the 1h rule uses a 10m short window because the governed synthetic cadence is 10 minutes.'
  ]
};

fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(`SLO_30D_STATUS=${result.status}`);
console.log(`SLO_30D_OBSERVED_SLOTS=${samples.length}`);
console.log(`SLO_30D_COVERAGE_RATIO=${coverageRatio.toFixed(6)}`);
console.log(`SLO_30D_MAX_GAP_MINUTES=${maxGap}`);
console.log(`SLO_30D_ALERT_DELIVERY=${alertDeliveryPass?'PASS':'NOT_YET_CERTIFIED'}`);
for (const [name,s] of Object.entries(services)) {
  console.log(`SLO_30D_${name.toUpperCase()}_AVAILABILITY=${s.availability.toFixed(6)}`);
  console.log(`SLO_30D_${name.toUpperCase()}_P95_MS=${s.p95_latency_ms ?? 'null'}`);
}
