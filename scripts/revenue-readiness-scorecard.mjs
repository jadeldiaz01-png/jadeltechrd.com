import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const die = (m) => { throw new Error(`REVENUE_SCORECARD_${m}`); };
const nni = (v, n) => { const x=Number(v); if(!Number.isSafeInteger(x)||x<0) die(`INVALID_${n.toUpperCase()}`); return x; };
const nn = (v, n) => { const x=Number(v); if(!Number.isFinite(x)||x<0) die(`INVALID_${n.toUpperCase()}`); return x; };
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const usd = (v) => `US$${Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function buildScorecard(facts, config) {
  if (!facts || facts.source !== "commercial_d1.sales_settlements") die("UNTRUSTED_FACT_SOURCE");
  if (!("settled_amount_minor" in facts)) die("SETTLED_AMOUNT_REQUIRED");
  if (config?.currency !== "USD" || config?.scope !== "cumulative_settled_revenue") die("INVALID_CONFIG");
  if (config?.source?.table !== "sales_settlements" || config?.source?.query_semantics !== "SELECT_ONLY") die("INVALID_SOURCE_CONFIG");
  for (const k of ["d1_mutation_authorized","payment_mutation_authorized","financial_execution_authorized","external_side_effects_authorized"]) if(config.governance?.[k]!==false) die("GOVERNANCE_NOT_READ_ONLY");
  const amountMinor=nni(facts.settled_amount_minor,"settled_amount_minor");
  const settledUsd=r2(amountMinor/100);
  const yellow=nn(config.traffic_light?.yellow_min_ratio,"yellow_min_ratio");
  const green=nn(config.traffic_light?.green_min_ratio,"green_min_ratio");
  if (green!==1 || yellow<=0 || yellow>=green) die("INVALID_TRAFFIC_LIGHT");
  const milestones=(config.milestones||[]).map((m)=>{
    const target=nn(m.target_usd,"target_usd"); if(target<=0) die("INVALID_TARGET");
    const ratio=settledUsd/target;
    return {id:m.id,label:m.label,target_usd:target,settled_usd:settledUsd,
      progress_pct:r2(Math.min(100,ratio*100)),remaining_usd:r2(Math.max(0,target-settledUsd)),
      status:ratio>=green?"GREEN":ratio>=yellow?"YELLOW":"RED",achieved:ratio>=1};
  });
  if (!milestones.length) die("MILESTONES_REQUIRED");
  for(let i=1;i<milestones.length;i++) if(milestones[i].target_usd<=milestones[i-1].target_usd) die("MILESTONES_NOT_ASCENDING");
  const next=milestones.find(x=>!x.achieved)||null;
  return {
    schema:"jadel.revenue_readiness_scorecard.v1", generated_at:String(facts.generated_at||new Date().toISOString()),
    authority:"READ_ONLY_REPORT", scope:config.scope,
    facts:{settled_usd:settledUsd,settled_payments:nni(facts.settled_payments??0,"settled_payments"),
      total_requests:nni(facts.total_requests??0,"total_requests"),qualified_leads:nni(facts.qualified_leads??0,"qualified_leads"),
      converted_customers:nni(facts.converted_customers??0,"converted_customers")},
    milestones,next_milestone:next?{id:next.id,label:next.label,remaining_usd:next.remaining_usd,progress_pct:next.progress_pct,status:next.status}:null,
    all_targets_reached:!next, governance:config.governance
  };
}

export function markdown(s) {
  const out=["# Revenue Readiness Scorecard","",`**Settled revenue:** ${usd(s.facts.settled_usd)}`,
    `**Settled payments:** ${s.facts.settled_payments}`,`**Commercial requests:** ${s.facts.total_requests}`,
    `**Qualified leads:** ${s.facts.qualified_leads}`,`**Converted customers:** ${s.facts.converted_customers}`,"",
    "| Milestone | Status | Progress | Remaining |","|---|---:|---:|---:|"];
  for(const x of s.milestones) out.push(`| ${x.label} | ${x.status} | ${x.progress_pct.toFixed(2)}% | ${usd(x.remaining_usd)} |`);
  out.push("","Source of truth: `sales_settlements` with `status='MATCHED'` and `currency_code='USD'`.",
    "Read-only: no order creation, capture/refund, D1 mutation, secret change, or financial execution.");
  return `${out.join("\n")}\n`;
}

function cli(argv=process.argv.slice(2)) {
  const a={}; for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith("--")||argv[i+1]===undefined) die("INVALID_ARGS");a[argv[i].slice(2)]=argv[i+1];}
  for(const k of ["facts","config","json","markdown"]) if(!a[k]) die("MISSING_ARG");
  const s=buildScorecard(JSON.parse(fs.readFileSync(a.facts,"utf8")),JSON.parse(fs.readFileSync(a.config,"utf8")));
  for(const [p,c] of [[a.json,`${JSON.stringify(s,null,2)}\n`],[a.markdown,markdown(s)]]){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);}
  console.log(`REVENUE_READINESS_SCORECARD=PASS settled_usd=${s.facts.settled_usd.toFixed(2)}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{cli();}catch(e){console.error(e.message);process.exitCode=1;}}
