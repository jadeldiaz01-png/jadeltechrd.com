import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/paypal-live-readiness.yml', 'utf8');

test('PayPal LIVE readiness reports safe phase and HTTP diagnostics without response bodies', () => {
  for (const phase of ['oauth', 'webhook_lookup', 'worker_health', 'webhook_rejection']) {
    assert.match(workflow, new RegExp(`PAYPAL_READINESS phase=${phase}`));
  }
  assert.match(workflow, /secret=PAYPAL_CLIENT_ID result=(?:PRESENT|MISSING)/);
  assert.match(workflow, /secret=PAYPAL_CLIENT_SECRET result=(?:PRESENT|MISSING)/);
  assert.match(workflow, /secret=PAYPAL_WEBHOOK_ID result=(?:PRESENT|MISSING)/);
  assert.match(workflow, /HTTP_STATUS=/);
  assert.match(workflow, /ERROR=/);
  assert.doesNotMatch(workflow, /cat\s+\/tmp\/paypal-readiness\.json/);
  assert.doesNotMatch(workflow, /curl\s+--fail-with-body/);
  assert.doesNotMatch(workflow, /echo\s+["']?\$\{?(?:client_secret|client_id|webhook_id|token|webhook|health)/i);
});

test('readiness workflow remains non-financial and validates the same webhook contract', () => {
  assert.match(workflow, /PAYPAL_AUTOMATIC_CAPTURE_ENABLED:"false"/);
  assert.match(workflow, /PAYPAL_AUTOMATIC_RECONCILIATION_ENABLED:"false"/);
  assert.match(workflow, /PAYPAL_AUTOMATIC_CAPTURE_MAX_MINOR:"0"/);
  assert.match(workflow, /CHECKOUT\.ORDER\.APPROVED/);
  assert.match(workflow, /PAYMENT\.CAPTURE\.COMPLETED/);
  assert.match(workflow, /No order created and no money captured/);
});
