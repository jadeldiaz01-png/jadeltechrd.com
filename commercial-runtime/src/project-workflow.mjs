import { WorkflowEntrypoint } from "cloudflare:workers";

const NEXUS_POLICY_URL = "https://nexus.internal/v1/project-readiness";
const ALLOWED_DECISIONS = new Set(["ALLOW", "DENY", "REQUIRES_HUMAN"]);

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
    }, async () => {
      if (!this.env.NEXUS_POLICY) {
        return { decision: "REQUIRES_HUMAN", reason: "NEXUS_POLICY_BINDING_MISSING", fail_closed: true };
      }
      const response = await this.env.NEXUS_POLICY.fetch(new Request(NEXUS_POLICY_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.project_id,
          service_ids: JSON.parse(project.service_ids_json),
          requested_transition: "POLICY_ALLOWED"
        })
      }));
      if (!response.ok) return { decision: "REQUIRES_HUMAN", reason: `NEXUS_HTTP_${response.status}`, fail_closed: true };
      const result = await response.json();
      if (!ALLOWED_DECISIONS.has(result?.decision)) {
        return { decision: "REQUIRES_HUMAN", reason: "INVALID_NEXUS_DECISION", fail_closed: true };
      }
      return {
        decision: result.decision,
        reason: String(result.reason || "unspecified").slice(0, 500),
        evidence_id: result.evidence_id || null,
        fail_closed: result.decision !== "ALLOW"
      };
    });

    if (policy.decision === "DENY") {
      await step.do("persist policy denial", async () => {
        await updateProject(this.env, projectId, "VALIDATED", "DENIED");
      });
      return { project_id: projectId, state: "VALIDATED", policy_status: "DENIED" };
    }

    if (policy.decision === "REQUIRES_HUMAN") {
      await step.do("persist human review requirement", async () => {
        await updateProject(this.env, projectId, "POLICY_CHECK", "REQUIRES_HUMAN");
      });
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
