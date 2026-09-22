import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminLeadLifecycle } from "../src/worker.mjs";

const TOKEN = "admin-secret-token";
const PROJECT = "123e4567-e89b-42d3-a456-426614174000";

function request(method="GET", body) {
  return new Request("https://intake.jadeltechrd.com/api/v1/admin/lead-lifecycle", {
    method,
    headers: {
      authorization:`Bearer ${TOKEN}`,
      ...(body ? {"content-type":"application/json"} : {})
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("lead lifecycle rejects anonymous access", async () => {
  const response = await handleAdminLeadLifecycle(
    new Request("https://intake.jadeltechrd.com/api/v1/admin/lead-lifecycle"),
    { ADMIN_API_TOKEN:TOKEN, DB:{} }
  );
  assert.equal(response.status, 401);
});

test("lead lifecycle GET returns aggregate label readiness", async () => {
  let calls=0;
  const db={
    prepare() {
      calls += 1;
      if (calls === 1) return { all: async () => ({ results:[{project_id:PROJECT,name:"A",email:"a@example.com",latest_stage:null}] }) };
      return { all: async () => ({ results:[
        {stage:"working_lead",event_count:2,project_count:2},
        {stage:"close_convert_lead",event_count:1,project_count:1},
        {stage:"close_unconvert_lead",event_count:1,project_count:1}
      ] }) };
    }
  };
  const response=await handleAdminLeadLifecycle(request(),{ADMIN_API_TOKEN:TOKEN,DB:db});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.summary.positive_terminal_labels,1);
  assert.equal(body.summary.negative_terminal_labels,1);
});

test("first lifecycle transition must start at working_lead", async () => {
  const db={
    prepare(sql) {
      if (sql.includes("FROM project_requests")) return {bind(){return {first:async()=>({project_id:PROJECT})}}};
      if (sql.includes("source_event_id")) return {bind(){return {first:async()=>null}}};
      if (sql.includes("ORDER BY created_at")) return {bind(){return {first:async()=>null}}};
      throw new Error(sql);
    }
  };
  const response=await handleAdminLeadLifecycle(request("POST",{
    project_id:PROJECT,
    stage:"qualify_lead",
    source_event_id:"1234567890abcdef",
    reason_code:"OPERATOR_CONSOLE"
  }),{ADMIN_API_TOKEN:TOKEN,DB:db});
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,"INVALID_LEAD_STAGE_TRANSITION");
});

test("governed lifecycle accepts working_lead and writes only normalized evidence", async () => {
  let bound;
  const db={
    prepare(sql) {
      if (sql.includes("FROM project_requests")) return {bind(){return {first:async()=>({project_id:PROJECT})}}};
      if (sql.includes("source_event_id=?")) return {bind(){return {first:async()=>null}}};
      if (sql.includes("ORDER BY created_at")) return {bind(){return {first:async()=>null}}};
      if (sql.startsWith("INSERT INTO lead_lifecycle_events")) return {bind(...values){bound=values; return {run:async()=>({success:true})}}};
      throw new Error(sql);
    }
  };
  const response=await handleAdminLeadLifecycle(request("POST",{
    project_id:PROJECT,
    stage:"working_lead",
    source_event_id:"1234567890abcdef",
    reason_code:"OPERATOR_CONSOLE"
  }),{ADMIN_API_TOKEN:TOKEN,DB:db});
  const body=await response.json();
  assert.equal(response.status,201);
  assert.equal(body.stage,"working_lead");
  assert.equal(bound.includes("human"),true);
  assert.match(bound.find((v)=>typeof v==="string" && v.includes("reason_code")),/OPERATOR_CONSOLE/);
});

test("terminal lifecycle cannot be reopened", async () => {
  const db={
    prepare(sql) {
      if (sql.includes("FROM project_requests")) return {bind(){return {first:async()=>({project_id:PROJECT})}}};
      if (sql.includes("source_event_id=?")) return {bind(){return {first:async()=>null}}};
      if (sql.includes("ORDER BY created_at")) return {bind(){return {first:async()=>({stage:"close_convert_lead"})}}};
      throw new Error(sql);
    }
  };
  const response=await handleAdminLeadLifecycle(request("POST",{
    project_id:PROJECT,
    stage:"working_lead",
    source_event_id:"1234567890abcdef",
    reason_code:"OTHER"
  }),{ADMIN_API_TOKEN:TOKEN,DB:db});
  assert.equal(response.status,409);
});
