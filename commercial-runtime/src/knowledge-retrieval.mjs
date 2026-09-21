const OBJECTIVE_QUERY = {
  FUNNEL_DIAGNOSIS: "approved funnel analytics conversion measurement landing page optimization",
  REVENUE_RECONCILIATION: "approved revenue reconciliation settled cash payment ledger evidence policy",
  EXPERIMENT_PLANNING: "approved experimentation measurement guardrails conversion funnel",
  OPERATING_REVIEW: "approved operating revenue intelligence SLO policy evidence"
};

function clean(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

export function knowledgeRuntimeStatus(env = {}) {
  const blockers = [];
  if (!env.AI) blockers.push("WORKERS_AI_BINDING_MISSING");
  if (!env.KNOWLEDGE_INDEX) blockers.push("KNOWLEDGE_INDEX_BINDING_MISSING");
  if (!env.AI_EMBEDDING_MODEL || String(env.AI_EMBEDDING_MODEL).startsWith("REPLACE_")) blockers.push("EMBEDDING_MODEL_MISSING");
  return { enabled: blockers.length === 0, blockers, authority: "READ_ONLY_APPROVED_CORPUS" };
}

function embeddingFrom(result) {
  if (Array.isArray(result?.data?.[0])) return result.data[0];
  if (Array.isArray(result?.data) && result.data.every((x) => typeof x === "number")) return result.data;
  if (Array.isArray(result?.embeddings?.[0])) return result.embeddings[0];
  throw new Error("EMBEDDING_RESPONSE_INVALID");
}

export async function retrieveApprovedKnowledge(objective, env) {
  const query = OBJECTIVE_QUERY[objective];
  if (!query) throw new Error("KNOWLEDGE_OBJECTIVE_NOT_ALLOWED");
  const status = knowledgeRuntimeStatus(env);
  if (!status.enabled) return { status: "NOT_CONFIGURED", blockers: status.blockers, items: [] };

  const embeddingResult = await env.AI.run(String(env.AI_EMBEDDING_MODEL), { text: [query] });
  const vector = embeddingFrom(embeddingResult);
  const result = await env.KNOWLEDGE_INDEX.query(vector, {
    topK: 4,
    returnMetadata: "all",
    filter: { trust: "APPROVED", active: true }
  });

  const items = (result?.matches || []).slice(0, 4).map((match) => ({
    source: clean(match?.metadata?.source, 200),
    revision: clean(match?.metadata?.revision, 100),
    trust: match?.metadata?.trust === "APPROVED" ? "APPROVED" : "UNTRUSTED",
    text: clean(match?.metadata?.text, 1200),
    score: Number.isFinite(match?.score) ? match.score : null
  })).filter((item) => item.trust === "APPROVED" && item.text);

  return { status: "READY", items };
}
