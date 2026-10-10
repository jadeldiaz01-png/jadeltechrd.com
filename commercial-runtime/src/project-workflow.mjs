import { WorkflowEntrypoint } from "cloudflare:workers";
import { evaluateNexusPolicy, persistNexusPolicyDecision } from "./nexus-policy.mjs";

async function updateProject(env, projectId, state, policyStatus) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE project_requests SET state=?,policy_status=?,updated_at=? WHERE project_id=?"
  ).bind(state, policyStatus, now, projectId).run();
}

export class ProjectLifecycleWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const projectId = event?.payload?.project_id;
    if (!projectId) throw new Error("MISSING_PROJECT_ID");

    const project = await step.do("load validated request", async () => {
      const row = await this.env.DB.prepare(
        "SELECT project_id,service_ids_json,state,policy_status FROM project_requests WHERE project_id=? LIMIT 1"
      ).bind(projectId).first();
      if (!row) throw new Error("PROJECT_NOT_FOUND");
      if (!new Set(["VALIDATED","POLICY_CHECK"]).has(row.state)) throw new Error(`INVALID_START_STATE:${row.state}`);
      return row;
    });

    const policy = await step.do("Nexus readiness and policy evaluation", {
      retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
      timeout: "30 seconds"
    }, async () => evaluateNexusPolicy(this.env, project));

    // Persist reason/evidence before deciding the next state, including fail-closed outcomes.
    await step.do("persist Nexus policy decision", async () => {
      const state = policy.decision === "DENY" ? "VALIDATED" : "POLICY_CHECK";
      const policyStatus = policy.decision === "DENY" ? "DENIED"
        : policy.decision === "REQUIRES_HUMAN" ? "REQUIRES_HUMAN" : "PENDING";
      await persistNexusPolicyDecision(this.env, projectId, policy, state, policyStatus);
    });

    if (policy.decision === "DENY") {
      return { project_id: projectId, state: "VALIDATED", policy_status: "DENIED" };
    }

    if (policy.decision === "REQUIRES_HUMAN") {
      let approval;
      try {
        approval = await step.waitForEvent("wait for authorized policy approval", {
          type: "policy-approval",
          timeout: "7 days"
        });
      } catch {
        return { project_id: projectId, state: "POLICY_CHECK", policy_status: "REQUIRES_HUMAN", timed_out: true };
      }
      if (approval?.payload?.approved !== true || approval?.payload?.project_id !== projectId) {
        return { project_id: projectId, state: "POLICY_CHECK", policy_status: "REQUIRES_HUMAN", approved: false };
      }
    }

    await step.do("promote only to policy allowed", async () => {
      await updateProject(this.env, projectId, "POLICY_ALLOWED", "ALLOWED");
    });

    return {
      project_id: projectId,
      state: "POLICY_ALLOWED",
      policy_status: "ALLOWED",
      next: "QUOTED",
      note: "No payment, deployment, publication, credentials or ACTIVE transition is performed by this workflow."
    };
  }
}
