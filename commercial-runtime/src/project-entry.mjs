import worker from "./worker.mjs";
import { emitTelemetry, routeName } from "./telemetry.mjs";
export { ProjectLifecycleWorkflow } from "./project-workflow.mjs";

export default {
  async fetch(request, env, ctx) {
    const started = performance.now();
    const invocationId = crypto.randomUUID();
    const route = routeName(request);
    try {
      const response = await worker.fetch(request, env, ctx);
      emitTelemetry({
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
      emitTelemetry({
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
      emitTelemetry({
        event: "scheduled_dispatch_completed",
        invocation_id: invocationId,
        duration_ms: Math.round((performance.now() - started) * 10) / 10,
        outcome: "success",
      });
    } catch (error) {
      emitTelemetry({
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
