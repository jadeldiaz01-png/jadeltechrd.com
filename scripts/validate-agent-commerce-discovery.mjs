#!/usr/bin/env node
import fs from "node:fs";
import {
  SERVICE_DISPLAY_NAMES,
  SERVICE_PRICING_CATALOG,
} from "../commercial-runtime/src/service-pricing.mjs";
import { OFFER_CATALOG } from "../commercial-runtime/src/offer-catalog.mjs";

const catalog = JSON.parse(fs.readFileSync("agent-services.json", "utf8"));
const llms = fs.readFileSync("llms.txt", "utf8");
const pagesWorkflow = fs.readFileSync(".github/workflows/pages.yml", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(catalog.schema_version === "2026-10-01.1", "unexpected catalog schema");
assert(catalog.authority.autonomous_external_submission === false, "external submission must remain gated");
assert(catalog.authority.autonomous_contract_acceptance === false, "contract acceptance must remain gated");
assert(catalog.authority.autonomous_financial_execution === false, "financial execution must remain gated");
assert(catalog.authority.autonomous_production_deploy === false, "production deploy must remain gated");
assert(catalog.experimental_machine_commerce.x402.version === 2, "x402 must be v2");
assert(catalog.experimental_machine_commerce.x402.role === "SELLER_ONLY", "x402 must remain seller-only");
assert(catalog.experimental_machine_commerce.x402.network === "eip155:84532", "x402 must remain Base Sepolia CAIP-2");
assert(catalog.experimental_machine_commerce.x402.real_funds === false, "x402 real funds must remain disabled");
assert(catalog.experimental_machine_commerce.autonomous_replication === false, "replication must remain disabled");
assert(catalog.discovery.a2a_agent_card === null, "do not advertise an A2A card before a conformant endpoint exists");
assert(!fs.existsSync(".well-known/agent-card.json"), "A2A Agent Card requires a separately certified A2A endpoint");

const byId = new Map(catalog.services.map((service) => [service.id, service]));
assert(byId.size === catalog.services.length, "duplicate service ids");

for (const [serviceId, runtimePricing] of Object.entries(SERVICE_PRICING_CATALOG)) {
  const discovered = byId.get(serviceId);
  assert(discovered, `missing service in agent catalog: ${serviceId}`);
  assert(discovered.name === SERVICE_DISPLAY_NAMES[serviceId], `display name drift: ${serviceId}`);
  assert(
    JSON.stringify(discovered.pricing) === JSON.stringify(runtimePricing),
    `pricing drift: ${serviceId}`,
  );
}
assert(byId.size === Object.keys(SERVICE_PRICING_CATALOG).length, "unexpected service in agent catalog");

const offers = Array.isArray(catalog.offers) ? catalog.offers : [];
const offersById = new Map(offers.map((offer) => [offer.id, offer]));
assert(offersById.size === offers.length, "duplicate public offer ids");
for (const [offerId, runtimeOffer] of Object.entries(OFFER_CATALOG)) {
  const discovered = offersById.get(offerId);
  assert(discovered, `missing public offer mapping: ${offerId}`);
  assert(discovered.service_id === runtimeOffer.serviceId, `offer service drift: ${offerId}`);
  assert(
    discovered.primary_price_component === runtimeOffer.primaryPriceComponent,
    `offer price-component drift: ${offerId}`,
  );
  assert(
    discovered.landing_url === `https://jadeltechrd.com${runtimeOffer.landingPath}`,
    `offer landing drift: ${offerId}`,
  );
  assert(discovered.checkout_authority === "HUMAN_GATED", `offer checkout authority drift: ${offerId}`);
}
assert(offersById.size === Object.keys(OFFER_CATALOG).length, "unexpected public offer mapping");

for (const required of [
  "https://jadeltechrd.com/",
  "https://jadeltechrd.com/solicitar-proyecto.html",
  "https://jadeltechrd.com/agent-services.json",
]) {
  assert(llms.includes(required), `llms.txt missing ${required}`);
}
assert(
  /No claim of guaranteed income/i.test(llms),
  "llms.txt must explicitly disclaim guaranteed-income claims",
);
for (const asset of ["llms.txt", "agent-services.json"]) {
  assert(
    pagesWorkflow.includes(`test -s _site/${asset}`),
    `Pages workflow must stage and verify ${asset} before manual promotion`,
  );
}
assert(
  pagesWorkflow.includes("DEPLOY_PUBLIC_SITE"),
  "Pages workflow must require explicit public-site deployment confirmation",
);

console.log(JSON.stringify({
  status: "PASS",
  services: byId.size,
  offers: offersById.size,
  x402: catalog.experimental_machine_commerce.x402,
  a2a_status: catalog.discovery.a2a_status,
}, null, 2));
