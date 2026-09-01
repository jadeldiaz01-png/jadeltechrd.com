function routeName(request) {
  try {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") return "health";
    if (pathname === "/api/v1/public-config") return "public_config";
    if (pathname === "/api/v1/project-requests") return "project_requests";
    if (pathname === "/api/v1/paypal/webhooks") return "paypal_webhooks";
    if (pathname === "/api/v1/admin/approvals") return "admin_approvals";
    return "other";
  } catch {
    return "invalid_url";
  }
}

function telemetryEvent(event, now = () => new Date().toISOString()) {
  return {
    schema: "jadel.runtime.telemetry.v1",
    ts: now(),
    ...event,
  };
}

function serializeTelemetry(event, now) {
  return JSON.stringify(telemetryEvent(event, now));
}

function emitTelemetry(event, logger = console.log, now) {
  // Event callers must provide only normalized metadata. Never pass URLs with
  // query strings, request bodies, PII, auth headers, Turnstile tokens, or
  // provider credentials into this boundary.
  logger(serializeTelemetry(event, now));
}

export { emitTelemetry, routeName, serializeTelemetry, telemetryEvent };
