import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SERVICE_PRICING_CATALOG } from '../commercial-runtime/src/service-pricing.mjs';

const fallback = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const surfaces = [['static fallback', fallback], ['interactive app', app]];

for (const [name, source] of surfaces) {
  test(`${name} distinguishes configured webhook from pending positive payment reconciliation`, () => {
    assert.doesNotMatch(source, /console-state[^>]*>\s*READY\s*</i);
    assert.doesNotMatch(source, /<span class="event-ok">PASS<\/span><b>Evidence ledger<\/b>/i);
    assert.match(source, /class="event-ok">(?:CONFIGURADO|CONFIGURED)<\/span><b>PayPal LIVE webhook<\/b>/i);
    assert.match(source, /firma inválida rechazada|invalid-signature probe rejected/i);
    assert.match(source, /class="event-wait">(?:PENDIENTE|PENDING)<\/span><b>(?:Evidence ledger|Payment evidence)<\/b>/i);
    assert.match(source, /primera conciliación positiva con captura real pendiente|first positive reconciliation with a real capture pending/i);
    assert.match(source, /US\$250/);
    assert.match(source, /console-state[^>]*>\s*SUPERVISADO\s*</i);
    assert.equal([...source.matchAll(/class="console-state"/g)].length, 1);
    assert.match(source, /no se marca PAID sin coincidencia exacta|only marks PAID after validating signature and exact match/i);
    assert.doesNotMatch(source, /webhook firmado y ledger de pagos pendientes de validación|webhook and ledger reconciliation not yet verified/i);
  });
}

const discovery = JSON.parse(fs.readFileSync('agent-services.json', 'utf8'));
test("all 11 publicly listed services have a quote-gated PayPal path without a direct payment link", () => {
  const ids = Object.keys(SERVICE_PRICING_CATALOG).sort();
  assert.equal(ids.length, 11);
  const discoveredIds = discovery.services.map(service => service.id).sort();
  assert.deepEqual(discoveredIds, ids);
  assert.equal(discovery.currency, 'USD');
  assert.equal(discovery.authority.autonomous_financial_execution, false);
  assert.equal(discovery.authority.autonomous_contract_acceptance, false);
  assert.ok(discovery.services.every(service => JSON.stringify(service.pricing) ===
    JSON.stringify(SERVICE_PRICING_CATALOG[service.id])), 'price catalog remains authoritative');
  for (const offer of discovery.offers) {
    assert.equal(offer.checkout_authority, 'HUMAN_GATED');
  }

  const visible = [...fallback.matchAll(/data-cta-id="service_quote_([a-z]+)"/g)].map(match => match[1]).sort();
  assert.deepEqual(visible, ids, 'each static service has a governed intake CTA');
  assert.equal([...fallback.matchAll(/data-cta-id="service_quote_[^"]+"[^>]*>Solicitar cotización<\/a>/g)].length, 11);
  assert.match(fallback, /Los 11 servicios permiten solicitar una cotización/);
  assert.match(fallback, /cotizaciones aceptadas en USD de hasta US\\$250/);
  assert.match(app, /Para los 11 servicios, primero solicita y acepta una cotización/);
  assert.match(app, /cotizaciones aprobadas en USD de hasta US\\$250/);
  assert.match(app, /governedIntakeUrl\(\[service\.id\]\)/);
  assert.ok(new RegExp('data-cta-id="service_quote_\\$\\{service\\.id\\}"[^>]*>Solicitar cotización</a>').test(app));

  for (const id of ids) {
    assert.ok(fallback.includes(`href="/solicitar-proyecto.html?services=${id}&utm_source=service_catalog`), `static intake path for ${id}`);
    assert.match(app, new RegExp(`id: "${id}"`));
  }
  for (const source of [fallback, app]) {
    assert.doesNotMatch(source, /https:\/\/www\.(?:sandbox\.)?paypal\.com\/checkoutnow/i);
    assert.doesNotMatch(source, /paypal\.com\/ncp\/payment\//i);
    assert.match(source, /cotización aprobada/i);
  }
});

test("monthly public prices are explicitly not auto-renewing PayPal subscriptions", () => {
  assert.equal(discovery.authority.autonomous_financial_execution, false);
  const recurring = Object.entries(SERVICE_PRICING_CATALOG)
    .filter(([, components]) => 'monthly' in components || 'monthly_pack' in components)
    .map(([serviceId]) => serviceId);
  assert.ok(recurring.length > 0);
  assert.ok(recurring.every(id => discovery.services.some(service => service.id === id)));
  assert.ok(recurring.every(id => ('monthly' in SERVICE_PRICING_CATALOG[id]) || ('monthly_pack' in SERVICE_PRICING_CATALOG[id])));
  assert.match(fallback, /ni suscripción automática/);
  assert.match(app, /suscripción automática/);
});
