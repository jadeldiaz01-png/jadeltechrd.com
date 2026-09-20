import fs from 'node:fs';
import path from 'node:path';

const probeDir = process.env.SLO_PROBE_DIR || 'slo-probes';
const targetDate = process.env.SLO_TARGET_DATE;
const outputPath = process.env.SLO_OUTPUT || 'slo-daily-summary.json';

if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
  throw new Error('SLO_TARGET_DATE must be YYYY-MM-DD');
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile() && entry.name === 'slo-probe.json') out.push(p);
  }
  return out;
}

const parsed = [];
for (const file of walk(probeDir)) {
  try {
    const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof obj.observed_at !== 'string' || !obj.observed_at.startsWith(targetDate)) continue;
    parsed.push(obj);
  } catch {
    // Ignore malformed extraction here; missing/invalid samples reduce coverage and cannot help certification.
  }
}

const byRun = new Map();
for (const sample of parsed) {
  const runId = String(sample.workflow_run_id ?? '');
  if (!runId) continue;
  const attempt = Number(sample.workflow_run_attempt ?? 0);
  const prev = byRun.get(runId);
  if (!prev || attempt >= Number(prev.workflow_run_attempt ?? 0)) byRun.set(runId, sample);
}

const all = [...byRun.values()].sort((a,b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
const scheduled = all.filter(x => x.event_name === 'schedule');
const excludedNonSchedule = all.length - scheduled.length;

const dayStartMs = Date.parse(`${targetDate}T00:00:00Z`);
const dayEndMs = Date.parse(`${targetDate}T24:00:00Z`);
const expectedSlots = 144;

function maxGapMinutes(samples) {
  if (!samples.length) return 1440;
  let max = Math.max(0, (Date.parse(samples[0].observed_at) - dayStartMs) / 60000);
  for (let i = 1; i < samples.length; i++) {
    max = Math.max(max, (Date.parse(samples[i].observed_at) - Date.parse(samples[i-1].observed_at)) / 60000);
  }
  max = Math.max(max, (dayEndMs - Date.parse(samples.at(-1).observed_at)) / 60000);
  return Number(max.toFixed(3));
}

function serviceSummary(samples, key) {
  let good = 0;
  let semanticFailures = 0;
  let transportFailures = 0;
  const latencies = [];
  for (const s of samples) {
    const p = s.probes?.[key];
    if (!p) continue;
    if (p.good === true) {
      good += 1;
      if (Number.isFinite(Number(p.latency_ms))) latencies.push(Number(p.latency_ms));
    }
    if (p.semantic_ok !== true) semanticFailures += 1;
    if (p.transport_ok !== true) transportFailures += 1;
  }
  return {
    observed: samples.length,
    good,
    bad: samples.length - good,
    semantic_failures: semanticFailures,
    transport_failures: transportFailures,
    successful_latency_ms: latencies
  };
}

const compactSamples = scheduled.map(s => ({
  observed_at: s.observed_at,
  workflow_run_id: String(s.workflow_run_id),
  workflow_run_attempt: String(s.workflow_run_attempt ?? '1'),
  source_sha: s.source_sha,
  public_site: {
    good: s.probes?.public_site?.good === true,
    semantic_ok: s.probes?.public_site?.semantic_ok === true,
    transport_ok: s.probes?.public_site?.transport_ok === true,
    http_code: String(s.probes?.public_site?.http_code ?? '000'),
    latency_ms: Number(s.probes?.public_site?.latency_ms ?? 99000)
  },
  commercial_intake: {
    good: s.probes?.commercial_intake?.good === true,
    semantic_ok: s.probes?.commercial_intake?.semantic_ok === true,
    transport_ok: s.probes?.commercial_intake?.transport_ok === true,
    http_code: String(s.probes?.commercial_intake?.http_code ?? '000'),
    latency_ms: Number(s.probes?.commercial_intake?.latency_ms ?? 99000)
  }
}));

const summary = {
  schema_version: '1.0',
  control_id: 'SITE_SLO_DAILY_ROLLUP',
  target_date: targetDate,
  generated_at: new Date().toISOString(),
  expected_slots: expectedSlots,
  scheduled_sample_count: scheduled.length,
  excluded_non_schedule_samples: excludedNonSchedule,
  coverage_ratio: scheduled.length / expectedSlots,
  maximum_gap_minutes: maxGapMinutes(scheduled),
  measurement_model: 'scheduled_first_attempt_no_retry',
  services: {
    public_site: serviceSummary(scheduled, 'public_site'),
    commercial_intake_health: serviceSummary(scheduled, 'commercial_intake')
  },
  samples: compactSamples
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2) + '\n');
console.log(`SLO_DAILY_DATE=${targetDate}`);
console.log(`SLO_DAILY_SCHEDULED_SAMPLES=${scheduled.length}`);
console.log(`SLO_DAILY_COVERAGE_RATIO=${summary.coverage_ratio.toFixed(6)}`);
console.log(`SLO_DAILY_MAX_GAP_MINUTES=${summary.maximum_gap_minutes}`);
