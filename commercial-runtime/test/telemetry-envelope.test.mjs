import test from 'node:test';
import assert from 'node:assert/strict';
import { routeName, serializeTelemetry } from '../src/telemetry.mjs';

test('route normalization never includes query strings or PII', () => {
  const request = new Request('https://intake.jadeltechrd.com/health?email=secret@example.com', {
    headers: { authorization: 'Bearer should-never-log' },
  });
  assert.equal(routeName(request), 'health');
});

test('telemetry serialization carries only normalized metadata supplied by the caller', () => {
  const serialized = serializeTelemetry({
    event: 'http_request_completed',
    invocation_id: 'test-invocation',
    route: 'health',
    method: 'GET',
    status: 200,
    duration_ms: 12.3,
    outcome: 'success',
  }, () => '2026-09-01T13:00:00.000Z');

  const event = JSON.parse(serialized);
  assert.equal(event.schema, 'jadel.runtime.telemetry.v1');
  assert.equal(event.event, 'http_request_completed');
  assert.equal(event.route, 'health');
  assert.equal(event.status, 200);
  assert.equal(event.ts, '2026-09-01T13:00:00.000Z');
  assert.ok(!serialized.includes('secret@example.com'));
  assert.ok(!serialized.includes('should-never-log'));
  assert.ok(!serialized.includes('?'));
});

test('unknown paths collapse to a non-sensitive route label', () => {
  const request = new Request('https://intake.jadeltechrd.com/private/path?token=do-not-log');
  assert.equal(routeName(request), 'other');
});
