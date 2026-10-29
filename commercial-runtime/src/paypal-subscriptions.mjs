const PAYPAL_BASES = new Map([
  ["live", "https://api-m.paypal.com"],
  ["sandbox", "https://api-m.sandbox.paypal.com"],
]);

function requestId(id, suffix) {
  const compact = String(id).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 30);
  return `jdlp${compact}${suffix}`;
}

function redirectUrl(value, fallback) {
  const url = new URL(value || `https://jadeltechrd.com/${fallback}`);
  if (url.protocol !== "https:" || !new Set(["jadeltechrd.com", "www.jadeltechrd.com"]).has(url.hostname)) {
    throw new Error("PAYPAL_SUBSCRIPTION_REDIRECT_INVALID");
  }
  return url.toString();
}

async function accessToken(env, apiBase, fetchImpl) {
  const response = await fetchImpl(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("PAYPAL_TOKEN_FAILED");
  const body = await response.json();
  if (!body?.access_token) throw new Error("PAYPAL_TOKEN_INVALID");
  return body.access_token;
}

async function paypalPost(url, token, requestKey, payload, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "paypal-request-id": requestKey,
      prefer: "return=representation",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("PAYPAL_SUBSCRIPTION_PROVIDER_FAILED");
  return response.json();
}

function approvalUrl(subscription) {
  const link = (subscription?.links || []).find((item) => item.rel === "approve");
  if (!link?.href) throw new Error("PAYPAL_SUBSCRIPTION_APPROVAL_URL_MISSING");
  const url = new URL(link.href);
  if (url.protocol !== "https:" || url.hostname !== "www.paypal.com") {
    throw new Error("PAYPAL_SUBSCRIPTION_APPROVAL_URL_REJECTED");
  }
  return url.toString();
}

export async function createPayPalMonthlySubscription(env, {
  subscriptionId,
  quoteId,
  amountMinor,
  serviceNames,
}, fetchImpl = fetch) {
  const environment = String(env.PAYPAL_ENVIRONMENT || "").toLowerCase();
  const apiBase = PAYPAL_BASES.get(environment);
  if (!apiBase) throw new Error("PAYPAL_ENVIRONMENT_INVALID");
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error("PAYPAL_SUBSCRIPTION_NOT_CONFIGURED");
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 1_000_000) {
    throw new Error("PAYPAL_SUBSCRIPTION_AMOUNT_OUT_OF_RANGE");
  }

  const token = await accessToken(env, apiBase, fetchImpl);
  const label = String(serviceNames || "JadelTech service").replace(/[^\p{L}\p{N} .&+()-]/gu, "").slice(0, 110);
  const product = await paypalPost(`${apiBase}/v1/catalogs/products`, token, requestId(subscriptionId, "p"), {
    name: `JadelTech · ${label}`,
    description: `Monthly service for quote ${quoteId}`,
    type: "SERVICE",
    category: "SOFTWARE",
  }, fetchImpl);

  const plan = await paypalPost(`${apiBase}/v1/billing/plans`, token, requestId(subscriptionId, "l"), {
    product_id: product.id,
    name: `Monthly service · ${quoteId.slice(0, 8)}`,
    description: `USD monthly billing for accepted JadelTech quote ${quoteId}`,
    status: "ACTIVE",
    billing_cycles: [{
      frequency: { interval_unit: "MONTH", interval_count: 1 },
      tenure_type: "REGULAR",
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: {
        fixed_price: {
          value: (amountMinor / 100).toFixed(2),
          currency_code: "USD",
        },
      },
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    },
  }, fetchImpl);

  const subscription = await paypalPost(`${apiBase}/v1/billing/subscriptions`, token, requestId(subscriptionId, "s"), {
    plan_id: plan.id,
    custom_id: subscriptionId,
    application_context: {
      brand_name: "JadelTech",
      locale: "en-US",
      shipping_preference: "NO_SHIPPING",
      user_action: "SUBSCRIBE_NOW",
      return_url: redirectUrl(env.PAYPAL_RETURN_URL, "?paypal=subscription-approved"),
      cancel_url: redirectUrl(env.PAYPAL_CANCEL_URL, "?paypal=subscription-cancelled"),
    },
  }, fetchImpl);

  if (!subscription?.id) throw new Error("PAYPAL_SUBSCRIPTION_INVALID_RESPONSE");
  return {
    productId: product.id,
    planId: plan.id,
    providerSubscriptionId: subscription.id,
    approvalUrl: approvalUrl(subscription),
    providerStatus: String(subscription.status || "APPROVAL_PENDING"),
  };
}
