import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fallback = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const surfaces = [['static fallback', fallback], ['interactive app', app]];

for (const [name, source] of surfaces) {
  test(`${name} does not claim payment readiness before webhook and ledger validation`, () => {
    assert.doesNotMatch(source, /console-state[^>]*>\s*READY\s*</i);
    assert.doesNotMatch(source, /<span class="event-ok">PASS<\/span><b>Evidence ledger<\/b>/i);
    assert.match(source, /class="event-wait">(?:PENDIENTE|PENDING)<\/span><b>(?:Evidence ledger|Payment evidence)<\/b>/i);
    assert.match(source, /console-state[^>]*>\s*SUPERVISADO\s*</i);
    assert.equal([...source.matchAll(/class="console-state"/g)].length, 1);
    assert.match(source, /webhook firmado y ledger de pagos pendientes de validación/i);
    assert.match(source, /no se marca PAID sin conciliación/i);
    assert.match(source, /Webhook PayPal \+ ledger \+ reconciliación/);
  });
}
