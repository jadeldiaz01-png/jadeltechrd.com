import test from "node:test";
import assert from "node:assert/strict";
import {
  SERVICE_PRICING_CATALOG,
  SERVICE_PRICING_CATALOG_VERSION,
  buildCatalogPrimaryQuoteItems,
  resolveCatalogPrice,
} from "../src/service-pricing.mjs";

test("canonical pricing catalog covers every public service", () => {
  assert.deepEqual(Object.keys(SERVICE_PRICING_CATALOG).sort(), [
    "analytics",
    "architecture",
    "cineforge",
    "governance",
    "meta",
    "multiagent",
    "quant",
    "revenue",
    "sales",
    "social",
    "support",
  ]);
  assert.match(SERVICE_PRICING_CATALOG_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
});

test("legacy exact baseline amount infers a unique price component", () => {
  const price = resolveCatalogPrice({
    serviceId:"support",
    unitAmountMinor:90000,
  });
  assert.equal(price.priceComponent, "setup");
  assert.equal(price.catalogVersion, SERVICE_PRICING_CATALOG_VERSION);
});

test("unknown services fail closed", () => {
  assert.throws(
    () => resolveCatalogPrice({ serviceId:"unknown-service", priceComponent:"setup", unitAmountMinor:25000 }),
    /UNKNOWN_SERVICE_ID/,
  );
});

test("minimum-priced service rejects an under-catalog quote", () => {
  assert.throws(
    () => resolveCatalogPrice({ serviceId:"sales", priceComponent:"setup", unitAmountMinor:149999 }),
    /CATALOG_PRICE_BELOW_MINIMUM/,
  );
});

test("fixed monthly service rejects a modified amount", () => {
  assert.throws(
    () => resolveCatalogPrice({ serviceId:"support", priceComponent:"monthly", unitAmountMinor:14899 }),
    /CATALOG_PRICE_MISMATCH/,
  );
});

test("minimum-priced service allows a higher custom quote only with explicit component", () => {
  assert.throws(
    () => resolveCatalogPrice({ serviceId:"architecture", unitAmountMinor:50000 }),
    /PRICE_COMPONENT_REQUIRED/,
  );
  const price = resolveCatalogPrice({
    serviceId:"architecture",
    priceComponent:"setup",
    unitAmountMinor:50000,
  });
  assert.equal(price.priceComponent, "setup");
  assert.equal(price.baselineAmountMinor, 25000);
  assert.equal(price.mode, "minimum");
});

test("monthly values missing from the old payment-link surface are canonicalized", () => {
  assert.equal(SERVICE_PRICING_CATALOG.revenue.monthly.amount_minor, 34900);
  assert.equal(SERVICE_PRICING_CATALOG.governance.monthly.amount_minor, 29900);
  assert.equal(SERVICE_PRICING_CATALOG.multiagent.monthly.amount_minor, 79000);
});


test("selected services produce deterministic primary quote items", () => {
  const items = buildCatalogPrimaryQuoteItems(["architecture","cineforge","analytics"]);
  assert.deepEqual(items.map((item) => ({
    service_id:item.service_id,
    price_component:item.price_component,
    unit_amount_minor:item.unit_amount_minor,
  })), [
    { service_id:"architecture", price_component:"setup", unit_amount_minor:25000 },
    { service_id:"cineforge", price_component:"unit", unit_amount_minor:18000 },
    { service_id:"analytics", price_component:"setup", unit_amount_minor:65000 },
  ]);
});

test("catalog quote builder rejects unknown or duplicate service selections", () => {
  assert.throws(() => buildCatalogPrimaryQuoteItems(["unknown"]), /UNKNOWN_SERVICE_ID/);
  assert.throws(() => buildCatalogPrimaryQuoteItems(["architecture","architecture"]), /INVALID_PROJECT_SERVICE_IDS/);
});
