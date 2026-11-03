import test from "node:test";
import assert from "node:assert/strict";

import {
  OFFER_CATALOG,
  OFFER_CATALOG_VERSION,
  resolveOfferSelection,
} from "../src/offer-catalog.mjs";
import { validateProjectRequest } from "../src/validation.mjs";

function baseInput(overrides = {}) {
  return {
    name:"Cliente Demo",
    email:"cliente@example.com",
    company:"Empresa Demo",
    service_ids:["architecture"],
    notes:"Necesito automatizar un proceso.",
    locale:"es-DO",
    turnstile_token:"turnstile-token",
    offer_id:"automation_blueprint",
    utm_source:"upwork",
    utm_medium:"organic",
    utm_campaign:"revenue_funnel_v1",
    utm_content:"automation_blueprint",
    ...overrides,
  };
}

test("canonical offer catalog binds each offer to one service and landing", () => {
  assert.match(OFFER_CATALOG_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
  assert.equal(OFFER_CATALOG.automation_blueprint.serviceId, "architecture");
  assert.equal(
    OFFER_CATALOG.automation_blueprint.landingPath,
    "/automatizacion-procesos-ia-rd.html",
  );
  assert.equal(OFFER_CATALOG.whatsapp_support.serviceId, "support");
  assert.equal(OFFER_CATALOG.sales_lead_intelligence.serviceId, "sales");
});

test("intake preserves bounded campaign attribution and server-resolved landing", () => {
  const value = validateProjectRequest(baseInput());
  assert.equal(value.offerId, "automation_blueprint");
  assert.equal(value.offerLandingPath, "/automatizacion-procesos-ia-rd.html");
  assert.equal(value.utmSource, "upwork");
  assert.equal(value.utmCampaign, "revenue_funnel_v1");
});

test("offer cannot claim attribution for a different selected service", () => {
  assert.throws(
    () => validateProjectRequest(baseInput({ service_ids:["support"] })),
    /OFFER_SERVICE_MISMATCH/,
  );
});

test("unknown offer ids fail closed instead of polluting attribution", () => {
  assert.throws(
    () => validateProjectRequest(baseInput({ offer_id:"invented_offer" })),
    /UNKNOWN_OFFER_ID/,
  );
});

test("offer attribution is optional for non-funnel intake", () => {
  const value = validateProjectRequest(baseInput({ offer_id:"" }));
  assert.equal(value.offerId, "");
  assert.equal(value.offerLandingPath, "");
});

test("control characters and oversized UTM values are rejected", () => {
  assert.throws(
    () => validateProjectRequest(baseInput({ utm_campaign:"bad\nvalue" })),
    /INVALID_UTM_CAMPAIGN/,
  );
  assert.throws(
    () => validateProjectRequest(baseInput({ utm_content:"x".repeat(121) })),
    /INVALID_UTM_CONTENT/,
  );
});

test("direct resolver rejects malformed offer ids", () => {
  assert.throws(
    () => resolveOfferSelection({
      offerId:"../automation",
      serviceIds:["architecture"],
    }),
    /INVALID_OFFER_ID/,
  );
});

test("internal navigation labels are discarded while recognized acquisition attribution is preserved", () => {
  const value = validateProjectRequest(baseInput({
    utm_source:"use_case_path",
    utm_medium:"homepage",
    utm_campaign:"service_intake",
  }));
  assert.equal(value.utmSource, "");
  assert.equal(value.utmMedium, "");
  assert.equal(value.utmCampaign, "");

  const external = validateProjectRequest(baseInput({
    utm_source:"upwork",
    utm_medium:"marketplace",
    utm_campaign:"automation_blueprint",
  }));
  assert.equal(external.utmSource, "upwork");
  assert.equal(external.utmMedium, "marketplace");
  assert.equal(external.utmCampaign, "automation_blueprint");
});
