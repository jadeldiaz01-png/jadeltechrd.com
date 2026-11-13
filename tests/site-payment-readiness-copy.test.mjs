import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SERVICE_PRICING_CATALOG } from '../commercial-runtime/src/service-pricing.mjs';

const fallback = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const surfaces = [['static fallback', fallback], ['interactive app', app]];

for (const [name, source] of surfaces) {
  test(`${name} puts the customer Blueprint before internal payment operations`, () => {
    const consoleStart = source.indexOf("agent-console");
    const blueprintStart = source.indexOf("blueprint-alcance", consoleStart);
    const hero = source.slice(consoleStart, blueprintStart);
    const payments = source.slice(source.indexOf("payment-section"));
    assert.doesNotMatch(hero, /console-state[^>]*>\s*READY\s*</i);
    assert.match(hero, /aria-label="Ejemplo ilustrativo del alcance del Blueprint, no una automatización activa"/i);
    assert.match(hero, /console-title">Blueprint · un flujo</i);
    assert.match(hero, /class="console-state">EJEMPLO</i);
    assert.match(hero, /<b>Mapa \+ plan<\/b>/i);
    assert.match(hero, /<b>Construcción aparte<\/b>/i);
    assert.doesNotMatch(hero, /PayPal LIVE webhook|Evidence ledger|Payment evidence|Policy gate|ORCHESTRATOR/i);
    assert.match(payments, /PayPal LIVE webhook|webhook (?:PayPal )?LIVE configurado/i);
    assert.match(payments, /primera conciliación positiva|primera captura real/i);
    assert.match(source, /US\$14,800/);
    assert.equal([...hero.matchAll(/class="console-state"/g)].length, 1);
    assert.match(payments, /no se marca PAID sin coincidencia exacta|solo se marca PAID después de validar/i);
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
  assert.ok(fallback.includes("US$250"));
  assert.match(app, /Para los 11 servicios, primero solicita y acepta una cotización/);
  assert.ok(app.includes("US$250"));
  assert.match(app, /governedIntakeUrl\(\[service\.id\]\)/);
  assert.ok(new RegExp('data-cta-id="service_quote_\\$\\{service\\.id\\}"[^>]*>Solicitar cotización</a>').test(app));

  for (const id of ids) {
    const serviceCta = fallback.match(new RegExp(`<a class="mini-action service-quote"[^>]*data-cta-id="service_quote_${id}"[^>]*href="([^"]+)"`));
    assert.ok(serviceCta, `static intake path for ${id}`);
    assert.ok(serviceCta[1].startsWith(`/solicitar-proyecto.html?services=${id}`));
    assert.doesNotMatch(serviceCta[1], /utm_(?:source|medium|campaign)=/);
    assert.match(app, new RegExp(`id: "${id}"`));
  }
  assert.doesNotMatch(app, /utm_source=service_catalog|utm_medium=homepage|utm_campaign=service_intake/);
  for (const source of [fallback, app]) {
    assert.doesNotMatch(source, /https:\/\/www\.(?:sandbox\.)?paypal\.com\/checkoutnow/i);
    assert.doesNotMatch(source, /paypal\.com\/ncp\/payment\//i);
    assert.match(source, /cotización aprobada/i);
  }
});

test("monthly public prices require explicit PayPal subscription approval", () => {
  assert.equal(discovery.authority.autonomous_financial_execution, false);
  const recurring = Object.entries(SERVICE_PRICING_CATALOG)
    .filter(([, components]) => 'monthly' in components || 'monthly_pack' in components)
    .map(([serviceId]) => serviceId);
  assert.ok(recurring.length > 0);
  assert.ok(recurring.every(id => discovery.services.some(service => service.id === id)));
  assert.ok(recurring.every(id => ('monthly' in SERVICE_PRICING_CATALOG[id]) || ('monthly_pack' in SERVICE_PRICING_CATALOG[id])));
  assert.match(fallback, /aprobación expresa de la suscripción en PayPal/i);
  assert.match(app, /suscripción separada que el comprador debe aprobar en PayPal/i);
});
