import test from "node:test";
import assert from "node:assert/strict";
import {handleAdminSettlements} from "../src/worker.mjs";

function envWithLedger(overrides={}) {
  const calls=[];
  const ledger={
    ledger_id:"11111111-1111-4111-8111-111111111111",
    provider:"paypal",
    ledger_state:"MATCHED",
    amount_usd:"100.00",
    currency_code:"USD",
    ...overrides
  };
  const db={
    calls,
    prepare(sql){
      return {
        bind(...args){
          const stmt={sql,args};
          return {
            ...stmt,
            first:async()=>{
              if(sql.includes("FROM payment_ledger")) return ledger;
              if(sql.includes("FROM settlement_events WHERE ledger_id")) return null;
              return null;
            },
            all:async()=>({results:[]}),
            run:async()=>{calls.push(stmt);return {success:true};}
          };
        },
        first:async()=>null,
        all:async()=>({results:[]})
      };
    },
    async batch(statements){
      calls.push(...statements.map((x)=>({sql:x.sql,args:x.args})));
      return statements.map(()=>({success:true}));
    }
  };
  return {ADMIN_API_TOKEN:"admin-secret-token",DB:db,_calls:calls};
}

function settlementRequest(body,token="admin-secret-token"){
  return new Request("https://intake.jadeltechrd.com/api/v1/admin/settlements",{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${token}`},
    body:JSON.stringify(body)
  });
}

const valid={
  confirmation:"RECORD_SETTLED_CASH",
  ledger_id:"11111111-1111-4111-8111-111111111111",
  settlement_reference:"provider-settlement-reference-123",
  settled_amount_usd:95.25,
  evidence_sha256:"a".repeat(64),
  settled_at:"2026-09-20T20:00:00Z"
};

test("settlement endpoint rejects anonymous writes",async()=>{
  const response=await handleAdminSettlements(settlementRequest(valid,"wrong"),envWithLedger());
  assert.equal(response.status,401);
});

test("settlement requires explicit human confirmation",async()=>{
  const response=await handleAdminSettlements(settlementRequest({...valid,confirmation:""}),envWithLedger());
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,"SETTLEMENT_CONFIRMATION_REQUIRED");
});

test("settlement cannot recognize unmatched payment",async()=>{
  const response=await handleAdminSettlements(settlementRequest(valid),envWithLedger({ledger_state:"REQUIRES_HUMAN"}));
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,"PAYMENT_NOT_MATCHED");
});

test("settlement amount cannot exceed matched gross amount",async()=>{
  const response=await handleAdminSettlements(settlementRequest({...valid,settled_amount_usd:101}),envWithLedger());
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,"SETTLEMENT_AMOUNT_INVALID");
});

test("settlement records only hashed provider reference and evidence sha",async()=>{
  const env=envWithLedger();
  const response=await handleAdminSettlements(settlementRequest(valid),env);
  const body=await response.json();
  assert.equal(response.status,201);
  assert.equal(body.state,"SETTLED_CASH");
  assert.equal(body.settled_amount_usd,95.25);
  assert.equal(body.evidence_sha256,"a".repeat(64));
  assert.equal(JSON.stringify(body).includes(valid.settlement_reference),false);
  const insert=env._calls.find((x)=>x.sql?.includes("INSERT INTO settlement_events"));
  assert.ok(insert);
  assert.equal(insert.args.includes(valid.settlement_reference),false);
  assert.match(insert.args[3],/^[a-f0-9]{64}$/);
});

test("settlement ledger read is authenticated and read only",async()=>{
  const env=envWithLedger();
  const ok=await handleAdminSettlements(
    new Request("https://intake.jadeltechrd.com/api/v1/admin/settlements",{headers:{authorization:"Bearer admin-secret-token"}}),
    env
  );
  assert.equal(ok.status,200);
  const denied=await handleAdminSettlements(
    new Request("https://intake.jadeltechrd.com/api/v1/admin/settlements",{method:"DELETE",headers:{authorization:"Bearer admin-secret-token"}}),
    env
  );
  assert.equal(denied.status,405);
});
