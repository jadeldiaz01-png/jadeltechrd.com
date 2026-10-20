// PREPARE_ONLY: deterministic quote candidate; no route, provider call, or side effects.
import { OFFER_CATALOG } from "./offer-catalog.mjs";
import { SERVICE_PRICING_CATALOG } from "./service-pricing.mjs";

export const BLUEPRINT_FIXED_SCOPE_ID = "BLUEPRINT_ONE_WORKFLOW_250_V1";

// A human-reviewed sub-scope of the existing "from US$250" architecture offer.
// This candidate is NOT an issued or accepted quote and grants no financial authority.
export function prepareBlueprintFixedQuotePreview({
  offerId,
  serviceIds,
  workflowCount = 1,
  implementationIncluded = false,
} = {}) {
  const offer = OFFER_CATALOG.automation_blueprint;
  const catalogPrice = SERVICE_PRICING_CATALOG.architecture?.setup;
  if (offerId !== offer.offerId) throw new Error("BLUEPRINT_OFFER_MISMATCH");
  if (!Array.isArray(serviceIds) || serviceIds.length !== 1 ||
      serviceIds[0] !== offer.serviceId) {
    throw new Error("BLUEPRINT_SCOPE_REVIEW_REQUIRED");
  }
  if (!Number.isSafeInteger(workflowCount) || workflowCount !== 1 ||
      implementationIncluded !== false) {
    throw new Error("BLUEPRINT_SCOPE_REVIEW_REQUIRED");
  }
  if (!catalogPrice || catalogPrice.mode !== "minimum" ||
      catalogPrice.amount_minor !== 25000) {
    throw new Error("BLUEPRINT_CATALOG_BASELINE_DRIFT");
  }

  return Object.freeze({
    scope_id: BLUEPRINT_FIXED_SCOPE_ID,
    offer_id: offer.offerId,
    service_id: offer.serviceId,
    currency_code: "USD",
    proposed_total_amount_minor: catalogPrice.amount_minor,
    price_state: "PROPOSED_REQUIRES_HUMAN_REVIEW",
    checkout_authority: "HUMAN_GATED",
    customer_quote_acceptance_required: true,
    provider_approval_url: null,
    payment_order_id: null,
    payment_created: false,
    payment_captured: false,
  });
}
