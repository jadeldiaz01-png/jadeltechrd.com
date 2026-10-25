import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/paypal-live-webhook-add-approved-event.yml', 'utf8');

test('LIVE webhook update is exact-SHA gated and requires the worker capture guard to pass', () => {
  assert.match(workflow, /confirmation:[\s\S]*ADD_CHECKOUT_ORDER_APPROVED_TO_PAYPAL_LIVE_WEBHOOK/);
  assert.match(workflow, /EXPECTED_SHA:[\s\S]*inputs\.expected_sha/);
  assert.match(workflow, /test "\$GITHUB_REF" = refs\/heads\/main/);
  assert.match(workflow, /test "\$GITHUB_SHA" = "\$EXPECTED_SHA"/);
  assert.match(workflow, /name: g1-cloudflare-readonly/);
  assert.match(workflow, /name: jadeltechrd/);
  assert.match(workflow, /needs: worker-config/);
  assert.match(workflow, /WORKER_PAYPAL_ENVIRONMENT=NOT_LIVE/);
  assert.match(workflow, /WORKER_REQUIRED_SECRET_BINDING=FAIL/);
  for (const flag of ['PAYPAL_AUTOMATIC_CAPTURE_ENABLED', 'PAYPAL_AUTOMATIC_RECONCILIATION_ENABLED']) {
    assert.match(workflow, new RegExp(`${flag}.*false|false.*${flag}`, 's'));
  }
});

test('mutation only adds CHECKOUT.ORDER.APPROVED to the existing webhook event list', () => {
  assert.match(workflow, /PATCH/);
  assert.match(workflow, /path:"\/event_types"/);
  assert.match(workflow, /CHECKOUT\.ORDER\.APPROVED/);
  assert.match(workflow, /https:\/\/intake\.jadeltechrd\.com\/api\/v1\/paypal\/webhooks/);
  assert.match(workflow, /original_names/);
  assert.match(workflow, /PAYPAL_LIVE_WEBHOOK_EVENT_VERIFY=PASS/);
  assert.doesNotMatch(workflow, /v2\/checkout\/orders|\/capture|\/refund|payouts|wrangler\s+deploy/i);
  assert.doesNotMatch(workflow, /curl\s+-v|echo\s+(?:"\$client_secret"|"\$token"|"Authorization: Bearer \$token")/i);
});
