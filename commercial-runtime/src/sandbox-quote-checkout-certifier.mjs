// Offline-only structural attestation. No PayPal SDK, network, D1 or routes.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_ORDER = /^[A-Za-z0-9-]{1,128}$/;
const AMOUNT_MINOR = 25000;
const CODE_READY = "SANDBOX_BINDING_STRUCTURALLY_VALID";

function result(code) {
  return Object.freeze({
    ready: code === CODE_READY,
    code,
    authority: "PREPARE_ONLY",
    evidence: "STRUCTURAL_ONLY_NOT_PROVIDER_VERIFIED",
    provider_environment: "sandbox",
    payable_amount_minor: code === CODE_READY ? AMOUNT_MINOR : null,
    currency_code: code === CODE_READY ? "USD" : null,
    checkout_url: null,
    provider_call_performed: false,
    payment_created: false,
    payment_captured: false,
    financial_execution_authorized: false,
  });
}

// Verify a *synthetic or previously obtained* PayPal Sandbox order snapshot.
// Never creates, captures or exposes checkout URLs and cannot certify real money.
export function assessSandboxQuoteCheckoutBinding(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return result("INVALID_INPUT");
  const { quote, quoteItems, paymentOrder, providerEnvironment } = input;
  if (providerEnvironment !== "sandbox") return result("SANDBOX_ONLY");
  if (!quote || typeof quote !== "object" || Array.isArray(quote) ||
      !paymentOrder || typeof paymentOrder !== "object" || Array.isArray(paymentOrder) ||
      !Array.isArray(quoteItems)) return result("MISSING_BINDING_EVIDENCE");

  if (!UUID.test(String(quote.quote_id ?? "")) ||
      !UUID.test(String(quote.project_id ?? "")) ||
      !UUID.test(String(paymentOrder.payment_order_id ?? ""))) {
    return result("INVALID_INTERNAL_ID");
  }
  if (quote.status !== "ACCEPTED" ||
      quote.policy_status !== "ALLOWED" ||
      quote.project_state !== "PAYMENT_PENDING") {
    return result("QUOTE_NOT_PAYMENT_READY");
  }
  if (quote.offer_id !== "automation_blueprint" ||
      quote.service_ids_json !== '["architecture"]') return result("BLUEPRINT_SCOPE_NOT_VERIFIED");
  if (quote.currency_code !== "USD" ||
      quote.total_amount_minor !== AMOUNT_MINOR) return result("QUOTE_PRICE_MISMATCH");

  if (quoteItems.length !== 1) return result("QUOTE_ITEMS_MISMATCH");
  const item = quoteItems[0];
  if (!item || item.quote_id !== quote.quote_id ||
      item.service_id !== "architecture" || item.price_component !== "setup" ||
      item.quantity !== 1 || item.unit_amount_minor !== AMOUNT_MINOR ||
      item.line_amount_minor !== AMOUNT_MINOR) return result("QUOTE_ITEMS_MISMATCH");

  if (paymentOrder.quote_id !== quote.quote_id ||
      paymentOrder.project_id !== quote.project_id ||
      paymentOrder.status !== "PENDING" || paymentOrder.provider !== "paypal") {
    return result("PAYMENT_ORDER_BINDING_MISMATCH");
  }
  if (paymentOrder.currency_code !== "USD" ||
      paymentOrder.amount_minor !== AMOUNT_MINOR) return result("PAYMENT_ORDER_PRICE_MISMATCH");
  if (typeof paymentOrder.provider_order_id !== "string" ||
      !PROVIDER_ORDER.test(paymentOrder.provider_order_id)) {
    return result("PROVIDER_ORDER_ID_INVALID");
  }

  let url;
  try { url = new URL(paymentOrder.provider_approval_url); }
  catch { return result("PROVIDER_CHECKOUT_URL_INVALID"); }
  if (url.protocol !== "https:" || url.hostname !== "www.sandbox.paypal.com" ||
      url.port || url.username || url.password || url.hash || url.pathname !== "/checkoutnow" ||
      [...url.searchParams.keys()].length !== 1 ||
      url.searchParams.getAll("token").length !== 1 ||
      url.searchParams.get("token") !== paymentOrder.provider_order_id) {
    return result("PROVIDER_CHECKOUT_URL_INVALID");
  }
  return result(CODE_READY);
}
