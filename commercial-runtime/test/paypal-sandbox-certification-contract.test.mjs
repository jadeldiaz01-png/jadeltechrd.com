import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const workflow = read(".github/workflows/paypal-real-sandbox-e2e.yml");
const provider = read("scripts/paypal-sandbox-provider.sh");
const certifier = read("scripts/paypal-sandbox-certify.sh");

test("sandbox D1 preparation and read-only certification use separate credentials", () => {
  const preparation = workflow.match(/  prepare-sandbox-d1:[\s\S]*?(?=\n  paypal-sandbox-phase:)/)?.[0] ?? "";
  const certification = workflow.match(/  certify-sandbox-result:[\s\S]*$/)?.[0] ?? "";

  assert.match(preparation, /CLOUDFLARE_D1_API_TOKEN_RAW: \$\{\{ secrets\.CLOUDFLARE_D1_API_TOKEN \}\}/);
  assert.doesNotMatch(preparation, /CLOUDFLARE_D1_READONLY_API_TOKEN/);
  assert.match(certification, /CLOUDFLARE_D1_READONLY_API_TOKEN_RAW: \$\{\{ secrets\.CLOUDFLARE_D1_READONLY_API_TOKEN \}\}/);
  assert.doesNotMatch(certification, /secrets\.CLOUDFLARE_D1_API_TOKEN \}\}/);
  assert.match(certifier, /CLOUDFLARE_D1_READONLY_API_TOKEN_RAW/);
});

test("automatic provider phase does not query D1 with the Worker deployment token", () => {
  assert.doesNotMatch(provider, /api\.cloudflare\.com\/client\/v4\/accounts\/\$account_id\/d1\/database\/\$DATABASE_ID\/query/);
  assert.match(provider, /PAYPAL_SANDBOX_SETTLEMENT_READONLY_CERTIFICATION=DEFERRED/);
});

test("automatic certification discovers exactly one settlement from read-only D1 results", () => {
  assert.match(certifier, /CLOUDFLARE_D1_READONLY_API_TOKEN_RAW/);
  assert.match(certifier, /SELECT s\.settlement_id/);
  assert.match(certifier, /PAYPAL_SANDBOX_SETTLEMENT_JOIN_COUNT=\$row_count/);
  assert.match(certifier, /settlement_count/);
  assert.doesNotMatch(certifier, /sql:"\s*(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP)\b/i);
});

test("already-completed automatic Sandbox orders are observed, never captured again", () => {
  const automatic = provider.match(/if \[ "\$PHASE" = auto_capture_certify \]; then([\s\S]*?)\n  else/)?.[1] ?? "";
  assert.notEqual(automatic, "");
  assert.doesNotMatch(automatic, /\/v2\/checkout\/orders\/\$paypal_order_id\/capture/);
});
