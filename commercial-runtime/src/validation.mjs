export const SERVICE_IDS = new Set([
  "architecture","support","sales","social","cineforge","meta","analytics","revenue","quant","governance","multiagent"
]);

const ALLOWED_FIELDS = new Set(["name","email","company","service_ids","notes","locale","turnstile_token"]);

export function validateIdempotencyKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }
  return value;
}

export function validateProjectRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_BODY");
  for (const key of Object.keys(input)) if (!ALLOWED_FIELDS.has(key)) throw new Error(`UNKNOWN_FIELD:${key}`);

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const company = typeof input.company === "string" ? input.company.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const locale = typeof input.locale === "string" ? input.locale.trim() : "es-DO";
  const turnstileToken = typeof input.turnstile_token === "string" ? input.turnstile_token.trim() : "";
  const serviceIds = Array.isArray(input.service_ids) ? [...new Set(input.service_ids)] : [];

  if (name.length < 2 || name.length > 100) throw new Error("INVALID_NAME");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
  if (company.length > 120) throw new Error("INVALID_COMPANY");
  if (notes.length > 2000) throw new Error("INVALID_NOTES");
  if (locale.length > 16) throw new Error("INVALID_LOCALE");
  if (turnstileToken.length < 1 || turnstileToken.length > 2048) throw new Error("INVALID_TURNSTILE_TOKEN");
  if (serviceIds.length < 1 || serviceIds.length > 8) throw new Error("INVALID_SERVICE_COUNT");
  for (const id of serviceIds) if (typeof id !== "string" || !SERVICE_IDS.has(id)) throw new Error("INVALID_SERVICE_ID");

  return { name, email, company, notes, locale, turnstileToken, serviceIds };
}
