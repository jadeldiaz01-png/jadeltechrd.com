import worker from "./worker.mjs";
export { ProjectLifecycleWorkflow } from "./project-workflow.mjs";

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

function emit(event) {
  // Deliberately excludes URL query strings, request bodies, names, email,
  // notes, auth headers, Turnstile tokens and provider credentials.
  console.log(JSON.stringify({
    schema: "jadel.runtime.telemetry.v1",
    ts: new Date().toISOString(),
    ...event,
  }));
}

export default {
  async fetch(request, env, ctx) {
    const started = performance.now();
    const invocationId = crypto.randomUUID();
    const route = routeName(request);
    try {
      const response = await worker.fetch(request, env, ctx);
      emit({
        event: "http_request_completed",
        invocation_id: invocationId,
        route,
        method: request.method,
        status: response.status,
        duration_ms: Math.round((performance.now() - started) * 10) / 10,
        outcome: response.status >= 500 ? "server_error" : response.status >= 400 ? "rejected" : "success",
      });
      return response;
    } catch (error) {
      emit({
        event: "http_request_uncaught",
        invocation_id: invocationId,
        route,
        method: request.method,
        duration_ms: Math.round((performance.now() - started) * 10) / 10,
        outcome: "exception",
        error_class: error?.name || "Error",
      });
      throw error;
    }
  },

  async scheduled(controller, env, ctx) {
    const started = performance.now();
    const invocationId = crypto.randomUUID();
    try {
      await worker.scheduled(controller, env, ctx);
      emit({
        event: "scheduled_dispatch_completed",
        invocation_id: invocationId,
        duration_ms: Math.round((performance.now() - started) * 10) / 10,
        outcome: "success",
      });
    } catch (error) {
      emit({
        event: "scheduled_dispatch_uncaught",
        invocation_id: invocationId,
        duration_ms: Math.round((performance.now() - started) * 10) / 10,
        outcome: "exception",
        error_class: error?.name || "Error",
      });
      throw error;
    }
  },
};
