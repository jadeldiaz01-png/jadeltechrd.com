import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../approval-console.js", import.meta.url), "utf8");

test("approval console requires read-only readiness before quote acceptance", () => {
  assert.match(source, /QUOTE_ACCEPT_READINESS_URL/);
  assert.match(source, /\/api\/v1\/admin\/quotes\/acceptance-readiness/);
  assert.match(source, /data-quote-readiness=/);
  assert.match(source, /data-quote-accept=.*disabled/);
  assert.match(source, /QUOTE_ACCEPTANCE_READY/);

  const readinessHandler = source.indexOf('button[data-quote-readiness]');
  const acceptanceHandler = source.indexOf('button[data-quote-accept]');
  assert.notEqual(readinessHandler, -1);
  assert.notEqual(acceptanceHandler, -1);
  assert.ok(readinessHandler < acceptanceHandler);
});

test("approval console exposes only validated HTTP and error codes", () => {
  assert.match(source, /SAFE_ERROR_CODE_RE/);
  assert.match(source, /function safeApiCode/);
  assert.match(source, /function formatApiError/);
  assert.match(source, /response\.status, body\.error/);
  assert.doesNotMatch(source, /\$\{error\.message\}/);
  assert.doesNotMatch(source, /JSON\.stringify\(body\)/);
});
