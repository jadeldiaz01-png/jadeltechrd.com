import test from 'node:test';
import assert from 'node:assert/strict';
import runtime from '../src/project-entry.mjs';

test('health emits structured telemetry without request secrets or query data', async () => {
  const original = console.log;
  const events = [];
  console.log = (value) => events.push(String(value));
  try {
    const request = new Request('https://intake.jadeltechrd.com/health?email=secret@example.com', {
      headers: {
        authorization: 'Bearer should-never-log',
      },
    });
    const response = await runtime.fetch(request, {}, {});
    assert.equal(response.status, 200);
    assert.equal(events.length, 1);
    const event = JSON.parse(events[0]);
    assert.equal(event.schema, 'jadel.runtime.telemetry.v1');
    assert.equal(event.event, 'http_request_completed');
    assert.equal(event.route, 'health');
    assert.equal(event.status, 200);
    const serialized = JSON.stringify(event);
    assert.ok(!serialized.includes('secret@example.com'));
    assert.ok(!serialized.includes('should-never-log'));
    assert.ok(!serialized.includes('?'));
  } finally {
    console.log = original;
  }
});
