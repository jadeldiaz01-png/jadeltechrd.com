#!/usr/bin/env node
import fs from "node:fs";
import {
  SERVICE_DISPLAY_NAMES,
  SERVICE_PRICING_CATALOG,
} from "../commercial-runtime/src/service-pricing.mjs";

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
for (const asset of ['llms.txt', 'agent-services.json']) {
  assert(
    pagesWorkflow.includes(`- "${asset}"`),
    `Pages workflow must deploy ${asset} on main changes`,
  );
}

console.log(JSON.stringify({
  status: "PASS",
  services: byId.size,
  x402: catalog.experimental_machine_commerce.x402,
  a2a_status: catalog.discovery.a2a_status,
}, null, 2));
