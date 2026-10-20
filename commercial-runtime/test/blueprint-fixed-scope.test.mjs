import test from "node:test";
import assert from "node:assert/strict";

import {
  BLUEPRINT_FIXED_SCOPE_ID, prepareBlueprintFixedQuotePreview,
} from "../src/blueprint-fixed-scope.mjs";

const base = () => ({
  offerId: "automation_blueprint",
  serviceIds: ["architecture"],
  workflowCount: 1,
  implementationIncluded: false,
});

test("US$250 fixed-scope proposal is canonical, frozen, and not a PayPal order", () => {
  const draft = prepareBlueprintFixedQuotePreview(base());
  assert.equal(draft.scope_id, BLUEPRINT_FIXED_SCOPE_ID);
  assert.equal(draft.offer_id, "automation_blueprint");
  assert.equal(draft.service_id, "architecture");
  assert.equal(draft.currency_code, "USD");
  assert.equal(draft.proposed_total_amount_minor, 25000);
  assert.equal(draft.price_state, "PROPOSED_REQUIRES_HUMAN_REVIEW");
  assert.equal(draft.checkout_authority, "HUMAN_GATED");
  assert.equal(draft.customer_quote_acceptance_required, true);
  assert.equal(draft.provider_approval_url, null);
  assert.equal(draft.payment_order_id, null);
  assert.equal(draft.payment_created, false);
  assert.equal(draft.payment_captured, false);
  assert.ok(Object.isFrozen(draft));
});

test("fixed-scope preparation rejects unknown offer and extra services", () => {
  for (const bad of [
    {offerId: "whatsapp_support"},
    {offerId: ""},
    {serviceIds: []},
    {serviceIds: ["support"]},
    {serviceIds: ["architecture", "support"]},
    {serviceIds: ["architecture", "architecture"]},
  ]) {
    assert.throws(() => prepareBlueprintFixedQuotePreview({...base(), ...bad}),
      /BLUEPRINT_(OFFER_MISMATCH|SCOPE_REVIEW_REQUIRED)/);
  }
});

test("fixed-scope preparation fails closed on custom or ambiguous implementations", () => {
  for (const bad of [
    {workflowCount: undefined},
    {implementationIncluded: undefined},
    {workflowCount: 0},
    {workflowCount: 2},
    {workflowCount: -1},
    {workflowCount: 1.5},
    {workflowCount: "1"},
    {implementationIncluded: true},
    {implementationIncluded: "false"},
  ]) {
    assert.throws(() => prepareBlueprintFixedQuotePreview({...base(), ...bad}),
      /BLUEPRINT_SCOPE_REVIEW_REQUIRED/);
  }
  assert.throws(() => prepareBlueprintFixedQuotePreview(),
    /BLUEPRINT_INPUT_INVALID/);
});

test("preview requires an explicit restricted shape; payment fields never pass", () => {
  for (const invalid of [null, undefined, "", 1, [], new Date()]) {
    assert.throws(() => prepareBlueprintFixedQuotePreview(invalid),
      /BLUEPRINT_(INPUT_INVALID|OFFER_MISMATCH)/);
  }
  for (const injected of [
    {payment_order_id:"external-order"},
    {provider_approval_url:"https://www.paypal.com/example"},
    {priceOverrideMinor:100},
    {quoteId:"already-approved"},
    {scopeVersion:"2"},
    {humanApproval:true},
  ]) {
    assert.throws(
      () => prepareBlueprintFixedQuotePreview({...base(), ...injected}),
      /BLUEPRINT_UNKNOWN_FIELD/,
    );
  }
});
