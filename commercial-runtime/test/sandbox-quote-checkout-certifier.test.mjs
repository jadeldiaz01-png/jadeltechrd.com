import test from "node:test";
import assert from "node:assert/strict";
import { assessSandboxQuoteCheckoutBinding } from "../src/sandbox-quote-checkout-certifier.mjs";

const q = "123e4567-e89b-12d3-a456-426614174000";
const p = "423e4567-e89b-12d3-a456-426614174000";
const o = "523e4567-e89b-12d3-a456-426614174000";
const provider = "SYNTHETIC-ORDER-001";
function fixture() {
  return {
    providerEnvironment: "sandbox",
    quote: {
      quote_id:q, project_id:p, status:"ACCEPTED", policy_status:"ALLOWED",
      project_state:"PAYMENT_PENDING", offer_id:"automation_blueprint",
      service_ids_json:'["architecture"]', currency_code:"USD",
      total_amount_minor:25000,
    },
    quoteItems: [{
      quote_id:q, service_id:"architecture", price_component:"setup",
      quantity:1, unit_amount_minor:25000, line_amount_minor:25000,
    }],
    paymentOrder: {
      payment_order_id:o, quote_id:q, project_id:p, status:"PENDING",
      provider:"paypal", provider_order_id:provider, amount_minor:25000,
      currency_code:"USD",
      provider_approval_url:"https://www.sandbox.paypal.com/checkoutnow?token="+provider,
    },
  };
}
const verify = (candidate) => assessSandboxQuoteCheckoutBinding(candidate);

test("synthetic quote-bound sandbox checkout is structurally valid and never returns a link", () => {
  const result = verify(fixture());
  assert.equal(result.ready, true);
  assert.equal(result.code, "SANDBOX_BINDING_STRUCTURALLY_VALID");
  assert.equal(result.authority, "PREPARE_ONLY");
  assert.equal(result.evidence, "STRUCTURAL_ONLY_NOT_PROVIDER_VERIFIED");
  assert.equal(result.payable_amount_minor, 25000);
  assert.equal(result.currency_code, "USD");
  assert.equal(result.checkout_url, null);
  assert.equal(result.provider_call_performed, false);
  assert.equal(result.payment_created, false);
  assert.equal(result.payment_captured, false);
  assert.equal(result.financial_execution_authorized, false);
  assert.ok(Object.isFrozen(result));
});

test("cannot be used for PayPal LIVE, omitted environment, or malformed input", () => {
  for (const env of ["live", "", null, undefined, "SANDBOX"]) {
    const result = verify({...fixture(), providerEnvironment:env});
    assert.equal(result.ready, false);
    assert.equal(result.code, "SANDBOX_ONLY");
  }
  for (const value of [null, undefined, 1, "", [], {}]) {
    const result = verify(value);
    assert.equal(result.ready, false);
    assert.equal(result.checkout_url, null);
  }
});

test("quote must be accepted with a reviewed policy and payment-pending state", () => {
  for (const changes of [
    {status:"ISSUED"}, {status:"EXPIRED"},
    {policy_status:"PENDING"}, {policy_status:"REQUIRES_HUMAN"},
    {project_state:"CUSTOMER_APPROVED"}, {project_state:"PAID"},
  ]) {
    const f=fixture(); Object.assign(f.quote, changes);
    assert.equal(verify(f).code, "QUOTE_NOT_PAYMENT_READY");
  }
});

test("offer and canonical single-service scope cannot be substituted", () => {
  for (const changes of [
    {offer_id:"whatsapp_support"}, {offer_id:""}, {offer_id:null},
    {service_ids_json:'["architecture","sales"]'},
    {service_ids_json:'["support"]'},
    {service_ids_json:'[]'},
  ]) {
    const f=fixture(); Object.assign(f.quote,changes);
    assert.equal(verify(f).code, "BLUEPRINT_SCOPE_NOT_VERIFIED");
  }
});

test("quote amount, order amount and currency must all match exactly", () => {
  for (const [target, changes, error] of [
    ["quote",{total_amount_minor:24999},"QUOTE_PRICE_MISMATCH"],
    ["quote",{total_amount_minor:"25000"},"QUOTE_PRICE_MISMATCH"],
    ["quote",{currency_code:"EUR"},"QUOTE_PRICE_MISMATCH"],
    ["paymentOrder",{amount_minor:25001},"PAYMENT_ORDER_PRICE_MISMATCH"],
    ["paymentOrder",{amount_minor:"25000"},"PAYMENT_ORDER_PRICE_MISMATCH"],
    ["paymentOrder",{currency_code:"EUR"},"PAYMENT_ORDER_PRICE_MISMATCH"],
  ]) {
    const f=fixture(); Object.assign(f[target],changes);
    assert.equal(verify(f).code,error);
  }
});

test("quote items require one bound architecture setup line for exact price", () => {
  for (const changes of [
    {quote_id:o}, {service_id:"support"}, {price_component:"unit"},
    {quantity:2}, {unit_amount_minor:1}, {line_amount_minor:24999},
  ]) {
    const f=fixture(); Object.assign(f.quoteItems[0],changes);
    assert.equal(verify(f).code,"QUOTE_ITEMS_MISMATCH");
  }
  for (const values of [[],[fixture().quoteItems[0],fixture().quoteItems[0]], [null]]) {
    const f=fixture(); f.quoteItems=values;
    assert.equal(verify(f).code,"QUOTE_ITEMS_MISMATCH");
  }
});

test("quote, project, provider and provider order identifiers cannot be swapped", () => {
  for (const [target,changes,error] of [
    ["quote",{quote_id:"not-a-uuid"},"INVALID_INTERNAL_ID"],
    ["quote",{project_id:"not-a-uuid"},"INVALID_INTERNAL_ID"],
    ["paymentOrder",{payment_order_id:"bad"},"INVALID_INTERNAL_ID"],
    ["paymentOrder",{quote_id:o},"PAYMENT_ORDER_BINDING_MISMATCH"],
    ["paymentOrder",{project_id:o},"PAYMENT_ORDER_BINDING_MISMATCH"],
    ["paymentOrder",{status:"COMPLETED"},"PAYMENT_ORDER_BINDING_MISMATCH"],
    ["paymentOrder",{provider:"stripe"},"PAYMENT_ORDER_BINDING_MISMATCH"],
    ["paymentOrder",{provider_order_id:""},"PROVIDER_ORDER_ID_INVALID"],
  ]) {
    const f=fixture(); Object.assign(f[target],changes);
    assert.equal(verify(f).code,error);
  }
});

test("PayPal Sandbox checkout URL must bind exactly to the stored provider order", () => {
  for (const bad of [
    "https://www.paypal.com/checkoutnow?token="+provider,
    "http://www.sandbox.paypal.com/checkoutnow?token="+provider,
    "https://www.sandbox.paypal.com.evil.tld/checkoutnow?token="+provider,
    "https://user@www.sandbox.paypal.com/checkoutnow?token="+provider,
    "https://www.sandbox.paypal.com:444/checkoutnow?token="+provider,
    "https://www.sandbox.paypal.com/redirect?token="+provider,
    "https://www.sandbox.paypal.com/checkoutnow?token=OTHER",
    "https://www.sandbox.paypal.com/checkoutnow?token="+provider+"&token=OTHER",
    "https://www.sandbox.paypal.com/checkoutnow?token="+provider+"&redirect=https://evil.tld",
    "https://www.sandbox.paypal.com/checkoutnow?token="+provider+"#fragment",
    "not-a-url", "",
  ]) {
    const f=fixture(); f.paymentOrder.provider_approval_url=bad;
    assert.equal(verify(f).code, "PROVIDER_CHECKOUT_URL_INVALID", bad);
  }
});

test("readiness result never echoes an approval URL or financial identifier", () => {
  const f=fixture();
  for (const candidate of [f, {...f,providerEnvironment:"live"}]) {
    const r=verify(candidate);
    assert.equal(r.checkout_url,null);
    assert.ok(!JSON.stringify(r).includes(provider));
    assert.ok(!JSON.stringify(r).includes(q));
    assert.ok(!JSON.stringify(r).includes("https:"));
  }
});
