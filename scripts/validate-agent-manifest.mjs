import fs from "node:fs";

const path = "config/agent-production-manifest.json";
const raw = fs.readFileSync(path, "utf8");
const manifest = JSON.parse(raw);
const errors = [];

const requiredTop = ["schema_version", "manifest_id", "publication_policy", "control_plane", "agents", "promotion_gates", "site_integration"];
for (const key of requiredTop) if (!(key in manifest)) errors.push(`missing top-level key: ${key}`);
if (manifest.schema_version !== "1.0.0") errors.push("unsupported schema_version");
if (!manifest.publication_policy?.fail_closed) errors.push("publication_policy.fail_closed must be true");
if (manifest.publication_policy?.default_execution_enabled !== false) errors.push("default_execution_enabled must be false");

const ids = new Set();
for (const agent of manifest.agents ?? []) {
  for (const key of ["id", "name", "category", "repository", "maturity", "production_state", "allowed_service_mode", "human_approval_points", "production_blockers", "verified_controls"]) {
    if (!(key in agent)) errors.push(`${agent.id ?? "unknown"}: missing ${key}`);
  }
  if (ids.has(agent.id)) errors.push(`duplicate agent id: ${agent.id}`);
  ids.add(agent.id);
  if (!["service", "pilot", "research"].includes(agent.maturity)) errors.push(`${agent.id}: invalid maturity ${agent.maturity}`);
  if (!Array.isArray(agent.production_blockers)) errors.push(`${agent.id}: production_blockers must be array`);
  if (!Array.isArray(agent.human_approval_points)) errors.push(`${agent.id}: human_approval_points must be array`);
  if (!Array.isArray(agent.verified_controls)) errors.push(`${agent.id}: verified_controls must be array`);

  const state = String(agent.production_state ?? "").toUpperCase();
  const claimsReady = state.includes("PRODUCTION_READY") && !state.includes("NOT_PRODUCTION_READY");
  if (claimsReady && agent.production_blockers?.length) {
    errors.push(`${agent.id}: cannot claim production-ready while blockers remain`);
  }
  if ((agent.category === "media" || agent.category === "automation" || agent.category === "research") &&
      /publish|financial|live|external/i.test(JSON.stringify(agent.capabilities ?? [])) &&
      (agent.human_approval_points ?? []).length === 0) {
    errors.push(`${agent.id}: side-effecting capability requires explicit human approval points`);
  }
}

const requiredGates = new Set(manifest.control_plane?.policy?.required_gates ?? []);
for (const gate of ["AUTHORIZED", "POLICY_ALLOWED", "TOS_ALLOWED", "GEO_ALLOWED", "RISK_ALLOWED", "IDENTITY_ALLOWED", "AUDITABLE", "IDEMPOTENT", "RECONCILABLE"]) {
  if (!requiredGates.has(gate)) errors.push(`missing institutional gate: ${gate}`);
}

if ((manifest.promotion_gates?.pilot_to_production ?? []).length < 10) errors.push("pilot_to_production gate is unexpectedly weak");
if (manifest.site_integration?.public_path !== "/config/agent-production-manifest.json") errors.push("unexpected public manifest path");

if (errors.length) {
  console.error("Agent manifest validation FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Agent manifest validation PASS: ${manifest.agents.length} agents, fail-closed, ${manifest.promotion_gates.pilot_to_production.length} promotion gates.`);
