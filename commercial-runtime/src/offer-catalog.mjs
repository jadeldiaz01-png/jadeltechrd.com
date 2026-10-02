export const OFFER_CATALOG_VERSION = "2026-10-02.1";

export const OFFER_CATALOG = Object.freeze({
  automation_blueprint: Object.freeze({
    offerId: "automation_blueprint",
    serviceId: "architecture",
    landingPath: "/automatizacion-procesos-ia-rd.html",
    primaryPriceComponent: "setup",
  }),
  whatsapp_support: Object.freeze({
    offerId: "whatsapp_support",
    serviceId: "support",
    landingPath: "/whatsapp-ia-empresas-rd.html",
    primaryPriceComponent: "setup",
  }),
  sales_lead_intelligence: Object.freeze({
    offerId: "sales_lead_intelligence",
    serviceId: "sales",
    landingPath: "/agente-ventas-ia-rd.html",
    primaryPriceComponent: "setup",
  }),
});

const OFFER_ID_RE = /^[a-z][a-z0-9_]{0,63}$/;

export function resolveOfferSelection({ offerId, serviceIds }) {
  const normalizedOfferId = typeof offerId === "string" ? offerId.trim() : "";
  if (!normalizedOfferId) return null;
  if (!OFFER_ID_RE.test(normalizedOfferId)) throw new Error("INVALID_OFFER_ID");

  const offer = OFFER_CATALOG[normalizedOfferId];
  if (!offer) throw new Error("UNKNOWN_OFFER_ID");
  if (!Array.isArray(serviceIds) || !serviceIds.includes(offer.serviceId)) {
    throw new Error("OFFER_SERVICE_MISMATCH");
  }
  return offer;
}
