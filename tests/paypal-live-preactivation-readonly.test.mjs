import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/paypal-live-preactivation-readonly.yml', 'utf8');

test('preactivation audit is manual-only, SHA gated, GET-only and cannot spend or deploy', () => {
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.match(workflow, /AUDIT_PAYPAL_LIVE_PREACTIVATION_READONLY/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /test "\$GITHUB_SHA" = "\$EXPECTED_SHA"/);
  assert.match(workflow, /git rev-parse refs\/remotes\/origin\/main/);
  assert.match(workflow, /EXPECTED_VERSION_PREFIX/);
  assert.match(workflow, /PREACTIVATION_VERSION=DOES_NOT_MATCH_SCREENSHOT/);
  assert.match(workflow, /PREACTIVATION_DEPLOYMENT_CHANGED=FAIL/);
  assert.match(workflow, /WORKER_CONFIGURATION_OPERATION=GET_ONLY/);
  assert.match(workflow, /PREACTIVATION_FINANCIAL_OPERATIONS=NONE/);
  assert.doesNotMatch(workflow, /^\s+(?:push|schedule|repository_dispatch):/m);
  assert.doesNotMatch(workflow, /(?:-X|--request)\s+(?:POST|PUT|PATCH|DELETE)|wrangler\s+deploy|\/capture\b|\/refund\b|secret\s+(?:put|delete)|payment_orders.*INSERT/i);
});

test('preactivation audit requires disabled values without weakening postactivation audit', () => {
  for (const required of [
    'PAYPAL_ENVIRONMENT:live',
    'PAYPAL_ORDER_CREATION_ENABLED:false',
    'PAYPAL_LIVE_ORDER_CREATION_ENABLED:false',
    'PAYPAL_AUTOMATIC_CAPTURE_ENABLED:false',
    'PAYPAL_AUTOMATIC_RECONCILIATION_ENABLED:false',
    'PAYPAL_AUTOMATIC_CAPTURE_MAX_MINOR:0',
    'PRODUCTION_AUTHORIZED:false',
    'FINANCIAL_EXECUTION_AUTHORIZED:false',
    'PAYPAL_SUBSCRIPTIONS_ENABLED:false',
    'MAX_AUTONOMOUS_CAPITAL_USD:0',
  ]) {
    assert.ok(workflow.includes(required), required);
  }
  assert.match(workflow, /secrets\.CLOUDFLARE_D1_READONLY_API_TOKEN/);
  assert.doesNotMatch(workflow, /secrets\.(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CF_TOKEN|CLOUDFLARE_TOKEN)/);
  assert.match(workflow, /name: d1-live-readonly-audit/);
  assert.match(workflow, /PREACTIVATION_CREDENTIAL_IDENTITY_MATCH=NOT_PROVEN/);
  assert.match(workflow, /PREACTIVATION_FAIL_CLOSED_AUDIT=PASS/);
  assert.match(workflow, /PREACTIVATION_SECRET name=\$name result=PRESENT_ONLY/);
  assert.doesNotMatch(workflow, /echo\s+["']?\$\{?(?:token|bindings|actual|client_secret|client_id|webhook_id)\b/i);
});

test('published postactivation audit is preserved as a separate policy', () => {
  const postactivation = fs.readFileSync('.github/workflows/audit-paypal-live-worker-flags-readonly.yml', 'utf8');
  assert.match(postactivation, /AUDIT_PAYPAL_LIVE_WORKER_FLAGS_ONLY/);
  assert.match(postactivation, /PAYPAL_AUTOMATIC_CAPTURE_ENABLED:true/);
});
