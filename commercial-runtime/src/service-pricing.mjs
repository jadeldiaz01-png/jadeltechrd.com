export const SERVICE_PRICING_CATALOG_VERSION = "2026-09-30.1";

export const SERVICE_DISPLAY_NAMES = Object.freeze({
  architecture: "Arquitectura Agentic & Automatización",
  support: "Agente de Soporte & Tickets",
  sales: "Sales & Lead Intelligence",
  social: "Social Trend Intelligence",
  cineforge: "CineForge · Video Premium",
  meta: "Meta/Facebook Integration & App Review",
  analytics: "Dashboards & Decision Intelligence",
  revenue: "Revenue Opportunity Intelligence",
  quant: "Quant Research & Trading Risk Systems",
  governance: "AI Governance & Production Readiness",
  multiagent: "Multi-Agent Orchestration",
});

export const SERVICE_PRICING_CATALOG = Object.freeze({
  architecture: Object.freeze({
    setup: Object.freeze({ amount_minor: 25000, mode: "minimum" }),
  }),
  support: Object.freeze({
    setup: Object.freeze({ amount_minor: 90000, mode: "exact" }),
    monthly: Object.freeze({ amount_minor: 14900, mode: "exact" }),
  }),
  sales: Object.freeze({
    setup: Object.freeze({ amount_minor: 150000, mode: "minimum" }),
    monthly: Object.freeze({ amount_minor: 29900, mode: "exact" }),
  }),
  social: Object.freeze({
    setup: Object.freeze({ amount_minor: 75000, mode: "exact" }),
    monthly: Object.freeze({ amount_minor: 19900, mode: "exact" }),
  }),
  cineforge: Object.freeze({
    unit: Object.freeze({ amount_minor: 18000, mode: "minimum" }),
    monthly_pack: Object.freeze({ amount_minor: 89900, mode: "minimum" }),
  }),
  meta: Object.freeze({
    setup: Object.freeze({ amount_minor: 85000, mode: "minimum" }),
  }),
  analytics: Object.freeze({
    setup: Object.freeze({ amount_minor: 65000, mode: "minimum" }),
    monthly: Object.freeze({ amount_minor: 9900, mode: "exact" }),
  }),
  revenue: Object.freeze({
    setup: Object.freeze({ amount_minor: 180000, mode: "minimum" }),
    monthly: Object.freeze({ amount_minor: 34900, mode: "exact" }),
  }),
  quant: Object.freeze({
    setup: Object.freeze({ amount_minor: 200000, mode: "minimum" }),
  }),
  governance: Object.freeze({
    setup: Object.freeze({ amount_minor: 250000, mode: "minimum" }),
    monthly: Object.freeze({ amount_minor: 29900, mode: "exact" }),
  }),
  multiagent: Object.freeze({
    setup: Object.freeze({ amount_minor: 450000, mode: "minimum" }),
    monthly: Object.freeze({ amount_minor: 79000, mode: "exact" }),
  }),
});

const COMPONENT_RE = /^[a-z][a-z0-9_]{0,31}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function resolveCatalogPrice({ serviceId, priceComponent, unitAmountMinor }) {
  const service = SERVICE_PRICING_CATALOG[serviceId];
  if (!service) fail("UNKNOWN_SERVICE_ID");

  if (!Number.isSafeInteger(unitAmountMinor) || unitAmountMinor < 0) {
    fail("INVALID_QUOTE_ITEM_AMOUNT");
  }

  let component = typeof priceComponent === "string" ? priceComponent.trim() : "";
  if (component && !COMPONENT_RE.test(component)) fail("INVALID_PRICE_COMPONENT");

  if (!component) {
    const exactMatches = Object.entries(service)
      .filter(([, rule]) => rule.amount_minor === unitAmountMinor)
      .map(([name]) => name);
    if (exactMatches.length !== 1) fail("PRICE_COMPONENT_REQUIRED");
    [component] = exactMatches;
  }

  const rule = service[component];
  if (!rule) fail("UNKNOWN_PRICE_COMPONENT");

  if (rule.mode === "exact" && unitAmountMinor !== rule.amount_minor) {
    fail("CATALOG_PRICE_MISMATCH");
  }
  if (rule.mode === "minimum" && unitAmountMinor < rule.amount_minor) {
    fail("CATALOG_PRICE_BELOW_MINIMUM");
  }

  return Object.freeze({
    serviceId,
    priceComponent: component,
    catalogVersion: SERVICE_PRICING_CATALOG_VERSION,
    baselineAmountMinor: rule.amount_minor,
    mode: rule.mode,
  });
}


export function buildCatalogPrimaryQuoteItems(serviceIds) {
  if (!Array.isArray(serviceIds) || serviceIds.length < 1 || serviceIds.length > 8) {
    fail("INVALID_PROJECT_SERVICE_IDS");
  }
  const unique = [...new Set(serviceIds)];
  if (unique.length !== serviceIds.length) fail("INVALID_PROJECT_SERVICE_IDS");

  return unique.map((serviceId) => {
    const service = SERVICE_PRICING_CATALOG[serviceId];
    const description = SERVICE_DISPLAY_NAMES[serviceId];
    if (!service || !description) fail("UNKNOWN_SERVICE_ID");

    const priceComponent = service.setup ? "setup" : service.unit ? "unit" : "";
    if (!priceComponent) fail("PRIMARY_PRICE_COMPONENT_MISSING");
    const rule = service[priceComponent];

    return Object.freeze({
      service_id: serviceId,
      description,
      quantity: 1,
      price_component: priceComponent,
      unit_amount_minor: rule.amount_minor,
    });
  });
}
