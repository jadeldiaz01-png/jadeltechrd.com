import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/audit-paypal-live-worker-flags-readonly.yml', 'utf8');

test('independent worker capture audit is manual, exact-SHA and read-only', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /AUDIT_PAYPAL_LIVE_WORKER_FLAGS_ONLY/);
  assert.match(workflow, /name: d1-live-readonly-audit/);
  assert.match(workflow, /secrets\.CLOUDFLARE_D1_READONLY_API_TOKEN/);
  assert.match(workflow, /test "\$GITHUB_SHA" = "\$EXPECTED_SHA"/);
  assert.match(workflow, /git rev-parse refs\/remotes\/origin\/main/);
  assert.match(workflow, /tokens\/verify/);
  assert.match(workflow, /workers\/scripts\/\$WORKER_NAME/);
  assert.match(workflow, /deployments\?per_page=1/);
  assert.match(workflow, /versions\/\$version_id/);
  assert.match(workflow, /WORKER_AUDIT_DEPLOYMENT_CHANGED=FAIL/);
  assert.match(workflow, /WORKER_CONFIGURATION_OPERATION=GET_ONLY/);
  assert.doesNotMatch(workflow, /(?:-X|--request)\s+(?:POST|PUT|PATCH|DELETE)|wrangler\s+deploy|\/capture|\/refund|secret\s+(?:put|delete)/i);
});

test('the audit requires explicit safe values and classifies wrong bindings without exposing them', () => {
  for (const flag of ['PAYPAL_AUTOMATIC_CAPTURE_ENABLED:true','PAYPAL_AUTOMATIC_RECONCILIATION_ENABLED:true','FINANCIAL_EXECUTION_AUTHORIZED:true','PAYPAL_AUTOMATIC_CAPTURE_MAX_MINOR:1480000']) {
    assert.ok(workflow.includes(flag), flag);
  }
  for (const category of ['ABSENT','DUPLICATE','WRONG_TYPE','ENABLED','OTHER_VALUE','PASS']) {
    assert.match(workflow,new RegExp('reason='+category));
  }
  assert.match(workflow, /if \[ "\$failed" -ne 0 \]; then echo WORKER_BOUNDED_PAYMENT_POLICY_AUDIT=FAIL/);
  assert.doesNotMatch(workflow, /echo\s+["']?\$(?:token|bindings|value)\b/);
});
