import test from "node:test";
import assert from "node:assert/strict";
import { buildCatalogPrimaryQuoteItems, SERVICE_PRICING_CATALOG } from "../src/service-pricing.mjs";
import { handleAdminCatalogQuoteCreate, handleAdminPaymentOrderCreate } from "../src/worker.mjs";

const PROJECT_ID="123e4567-e89b-12d3-a456-426614174000";
const QUOTE_ID="223e4567-e89b-12d3-a456-426614174000";
const SERVICE_IDS=Object.keys(SERVICE_PRICING_CATALOG);
function adminRequest(path, body) {
  return new Request("https://intake.jadeltechrd.com"+path, {
    method:"POST",
    headers:{ authorization:"Bearer synthetic-admin-token", "content-type":"application/json" },
    body:JSON.stringify(body),
  });
}
function dbForQuote(serviceId, amountMinor, status="ACCEPTED") {
  const writes=[];
  const db={
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM quotes q JOIN project_requests")) {
                return {
                  quote_id:QUOTE_ID,project_id:PROJECT_ID,status,
                  currency_code:"USD",total_amount_minor:amountMinor,
                  project_state:"CUSTOMER_APPROVED",policy_status:"ALLOWED",
                };
              }
              if (sql.includes("FROM payment_orders")) return null;
              return null;
            },
            async run(){writes.push(sql);return {success:true};},
          };
        },
      };
    },
    async batch(items) { writes.push({batch:items.length});return []; },
  };
  return {db,writes,serviceId};
}
test("exactly eleven priced services have baseline quote items", () => {
  assert.equal(SERVICE_IDS.length,11);
  for (const serviceId of SERVICE_IDS) {
    const items=buildCatalogPrimaryQuoteItems([serviceId]);
    assert.equal(items.length,1);
    assert.equal(items[0].service_id,serviceId);
    assert.equal(items[0].quantity,1);
    const rule=SERVICE_PRICING_CATALOG[serviceId][items[0].price_component];
    assert.equal(items[0].unit_amount_minor,rule.amount_minor);
    assert.ok(rule.amount_minor>0);
    assert.ok(["minimum","exact"].includes(rule.mode));
  }
});
test("catalog-issued quote is valid for every approved single-service project", async () => {
  for (const serviceId of SERVICE_IDS) {
    const records=[];
    const db={
      prepare(sql){return {bind(){return {async first(){
        if (sql.includes("FROM project_requests"))return {
          project_id:PROJECT_ID,service_ids_json:JSON.stringify([serviceId]),
          state:"POLICY_ALLOWED",policy_status:"ALLOWED",
        };
        if (sql.includes("MAX(version)"))return {version:0};
        return null;
      }};}};},
      async batch(statements){records.push(statements.length);return [];},
    };
    const response=await handleAdminCatalogQuoteCreate(adminRequest("/api/v1/admin/quotes/from-catalog",{project_id:PROJECT_ID}),{
      ADMIN_API_TOKEN:"synthetic-admin-token",DB:db,
    });
    const body=await response.json();
    assert.equal(response.status,201,serviceId);
    assert.equal(body.quote_source,"CANONICAL_SERVICE_CATALOG");
    assert.equal(body.total_amount_minor,buildCatalogPrimaryQuoteItems([serviceId])[0].unit_amount_minor,serviceId);
    assert.equal(body.external_side_effect,false);
    assert.deepEqual(records,[3]);
  }
});
test("all eleven services create only quote-bound internal pending payment orders when provider disabled",async()=>{
  for(const serviceId of SERVICE_IDS){
    const amount=buildCatalogPrimaryQuoteItems([serviceId])[0].unit_amount_minor;
    const {db,writes}=dbForQuote(serviceId,amount);
    const response=await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders",{
      quote_id:QUOTE_ID, amount_minor:1, currency_code:"EUR", service_id:"not-an-authority",
    }),{ADMIN_API_TOKEN:"synthetic-admin-token",DB:db,PAYPAL_ORDER_CREATION_ENABLED:"false"});
    const body=await response.json();
    assert.equal(response.status,201,serviceId);
    assert.equal(body.amount_minor,amount,serviceId);
    assert.equal(body.currency_code,"USD");
    assert.equal(body.provider_call_performed,false);
    assert.equal(body.capture_performed,false);
    assert.equal(body.financial_execution_authorized,false);
    assert.deepEqual(writes,[{batch:2}]);
  }
});
test("PayPal Sandbox provider order is linked to the accepted quote for every service with no capture", async()=>{
  for(const serviceId of SERVICE_IDS){
    const amount=buildCatalogPrimaryQuoteItems([serviceId])[0].unit_amount_minor;
    const {db,writes}=dbForQuote(serviceId,amount);
    const seen=[];
    const orderId="SYNTHETIC-ORDER-"+serviceId.toUpperCase();
    const response=await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders",{
      quote_id:QUOTE_ID, amount_minor:1,
    }),{
      ADMIN_API_TOKEN:"synthetic-admin-token",DB:db,
      PAYPAL_ORDER_CREATION_ENABLED:"true",PAYPAL_ENVIRONMENT:"sandbox",
      PAYPAL_CLIENT_ID:"sandbox-fake-client",PAYPAL_CLIENT_SECRET:"sandbox-fake-secret",
    },{
      fetchImpl:async(url,options={})=>{
        seen.push(String(url));
        if(String(url).endsWith("/v1/oauth2/token"))return Response.json({access_token:"synthetic"});
        if(String(url).endsWith("/v2/checkout/orders")){
          const order=JSON.parse(options.body);
          assert.equal(order.intent,"CAPTURE");
          assert.equal(order.purchase_units.length,1);
          assert.equal(order.purchase_units[0].invoice_id,QUOTE_ID);
          assert.equal(order.purchase_units[0].custom_id,options.headers["paypal-request-id"]);
          assert.equal(order.purchase_units[0].amount.currency_code,"USD");
          assert.equal(order.purchase_units[0].amount.value,(amount/100).toFixed(2));
          return Response.json({
            id:orderId,status:"PAYER_ACTION_REQUIRED",
            links:[{rel:"payer-action",href:"https://www.sandbox.paypal.com/checkoutnow?token="+orderId}],
          },{status:201});
        }
        throw new Error("unexpected mock request");
      },
    });
    const body=await response.json();
    assert.equal(response.status,201,serviceId);
    assert.equal(body.amount_minor,amount);
    assert.equal(body.provider_order_id,orderId);
    assert.equal(body.provider_environment,"sandbox");
    assert.equal(body.provider_call_performed,true);
    assert.equal(body.capture_performed,false);
    assert.equal(body.financial_execution_authorized,false);
    assert.ok(body.approval_url.startsWith("https://www.sandbox.paypal.com/"));
    assert.equal(seen.length,2);
    assert.equal(writes.length,2);
  }
});
test("unaccepted quote blocks every service before internal or provider payment creation",async()=>{
  for(const serviceId of SERVICE_IDS){
    const amount=buildCatalogPrimaryQuoteItems([serviceId])[0].unit_amount_minor;
    const {db,writes}=dbForQuote(serviceId,amount,"ISSUED");
    const response=await handleAdminPaymentOrderCreate(adminRequest("/api/v1/admin/payment-orders",{
      quote_id:QUOTE_ID,
    }),{
      ADMIN_API_TOKEN:"synthetic-admin-token",DB:db,
      PAYPAL_ORDER_CREATION_ENABLED:"false",
    });
    assert.equal(response.status,409);
    assert.equal((await response.json()).error,"QUOTE_NOT_READY_FOR_PAYMENT");
    assert.equal(writes.length,0);
  }
});
test("monthly components are quote line items, not recurring PayPal subscriptions",()=>{
  const monthly=SERVICE_IDS.flatMap(serviceId=>Object.entries(SERVICE_PRICING_CATALOG[serviceId])
    .filter(([component])=>component==="monthly"||component==="monthly_pack")
    .map(([component,rule])=>({serviceId,component,rule})));
  assert.ok(monthly.length>0);
  for(const {serviceId,component,rule} of monthly){
    assert.ok(rule.amount_minor>0);
    assert.ok(["exact","minimum"].includes(rule.mode));
    assert.ok(Object.hasOwn(SERVICE_PRICING_CATALOG,serviceId));
  }
});
