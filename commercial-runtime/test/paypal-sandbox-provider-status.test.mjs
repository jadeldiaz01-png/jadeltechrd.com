import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(new URL("../../scripts/paypal-sandbox-provider-status.sh", import.meta.url));
const bashProbe = spawnSync("bash", ["--version"], { encoding: "utf8" });
const bashAvailable = bashProbe.status === 0;

function runStatus(status) {
  return spawnSync("bash", ["-c", 'source "$1"; paypal_require_prepare_provider_status "$2"', "bash", helperPath, status], {
    encoding: "utf8",
  });
}

test("PayPal sandbox prepare accepts PAYER_ACTION_REQUIRED", { skip: bashAvailable ? false : "bash unavailable or blocked by host policy" }, () => {
  const result = runStatus("PAYER_ACTION_REQUIRED");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /PAYPAL_SANDBOX_PROVIDER_STATUS_OBSERVED=PAYER_ACTION_REQUIRED/);
  assert.equal(result.stderr, "");
});

test("PayPal sandbox prepare keeps CREATED as a valid preapproval-compatible status", { skip: bashAvailable ? false : "bash unavailable or blocked by host policy" }, () => {
  const result = runStatus("CREATED");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /PAYPAL_SANDBOX_PROVIDER_STATUS_OBSERVED=CREATED/);
});

test("PayPal sandbox prepare rejects post-approval or terminal states", { skip: bashAvailable ? false : "bash unavailable or blocked by host policy" }, () => {
  for (const status of ["APPROVED", "COMPLETED", "VOIDED", ""]) {
    const result = runStatus(status);
    assert.equal(result.status, 42, status || "empty");
    assert.match(result.stderr, /PAYPAL_SANDBOX_PROVIDER_STATUS_INVALID=/);
  }
});
