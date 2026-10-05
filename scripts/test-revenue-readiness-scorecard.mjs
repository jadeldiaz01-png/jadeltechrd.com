import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildScorecard, markdown } from "./revenue-readiness-scorecard.mjs";
const config=JSON.parse(fs.readFileSync(new URL("../config/revenue-readiness-scorecard.json",import.meta.url),"utf8"));
const f=(minor,extra={})=>({source:"commercial_d1.sales_settlements",settled_amount_minor:minor,settled_payments:0,total_requests:0,qualified_leads:0,converted_customers:0,...extra});

test("zero revenue",()=>{const s=buildScorecard(f(0),config);assert.deepEqual(s.milestones.map(x=>x.status),["RED","RED","RED"]);assert.deepEqual(s.milestones.map(x=>x.remaining_usd),[250,1000,5000]);});
test("US$250 reaches first milestone",()=>{const s=buildScorecard(f(25000,{settled_payments:1}),config);assert.equal(s.milestones[0].status,"GREEN");assert.equal(s.milestones[1].progress_pct,25);assert.equal(s.next_milestone.id,"settled_1000");});
test("yellow begins at half target",()=>{const s=buildScorecard(f(60000),config);assert.deepEqual(s.milestones.map(x=>x.status),["GREEN","YELLOW","RED"]);});
test("fails closed without settlement evidence",()=>{assert.throws(()=>buildScorecard({source:"commercial_d1.sales_settlements",reconciled_usd_revenue:5000},config),/SETTLED_AMOUNT_REQUIRED/);assert.throws(()=>buildScorecard({...f(100),source:"browser"},config),/UNTRUSTED/);});
test("markdown stays read-only",()=>{const m=markdown(buildScorecard(f(25000),config));assert.match(m,/sales_settlements/);assert.match(m,/Read-only/);});
