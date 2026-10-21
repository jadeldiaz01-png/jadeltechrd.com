import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SERVICE_PRICING_CATALOG } from '../commercial-runtime/src/service-pricing.mjs';

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

const discovery = JSON.parse(fs.readFileSync('agent-services.json', 'utf8'));
test("all 11 publicly listed services have a quote-gated PayPal path without a direct payment link", () => {
  const ids = Object.keys(SERVICE_PRICING_CATALOG).sort();
  assert.equal(ids.length, 11);
  const eligibility = discovery.paypal_quote_eligibility;
  assert.ok(eligibility, 'public discovery has PayPal eligibility policy');
  assert.equal(eligibility.provider, 'paypal');
  assert.equal(eligibility.currency_code, 'USD');
  assert.deepEqual([...eligibility.service_ids].sort(), ids);
  assert.equal(eligibility.payment_method, 'INDIVIDUAL_CHECKOUT_AFTER_ACCEPTED_QUOTE');
  assert.equal(eligibility.checkout_is_public_direct, false);
  assert.equal(eligibility.quote_required, true);
  assert.equal(eligibility.customer_acceptance_required, true);
  assert.equal(eligibility.automatic_recurring_billing, false);
  assert.equal(eligibility.payment_capture_requires_separate_human_authorization, true);
  assert.equal(eligibility.provider_webhook_and_human_reconciliation_required, true);
  assert.equal(eligibility.checkout_live_activation, 'NOT_VERIFIED_BY_THIS_CATALOG');
  assert.equal(eligibility.scope, 'ALL_11_PUBLIC_SERVICES');

  const visible = [...fallback.matchAll(/data-cta-id="service_quote_([a-z]+)"/g)].map(match => match[1]).sort();
  assert.deepEqual(visible, ids, 'each static service has a governed intake CTA');
  assert.equal([...fallback.matchAll(/>Cotizar · PayPal<\/a>/g)].length, 11);
  assert.match(fallback, /Los 11 servicios permiten solicitar una cotización para pagar con PayPal/);
  assert.match(app, /Para los 11 servicios, primero solicita y acepta una cotización/);
  assert.match(app, /governedIntakeUrl\(\[service\.id\]\)/);
  assert.match(app, /Cotizar · PayPal/);

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
  const policy = discovery.paypal_quote_eligibility;
  assert.equal(policy.monthly_prices, 'QUOTE_LINE_ITEMS_NOT_SUBSCRIPTION_PLANS');
  const recurring = Object.entries(SERVICE_PRICING_CATALOG)
    .filter(([, components]) => 'monthly' in components || 'monthly_pack' in components)
    .map(([serviceId]) => serviceId);
  assert.ok(recurring.length > 0);
  assert.ok(recurring.every(id => policy.service_ids.includes(id)));
  assert.match(fallback, /ni suscripción automática/);
  assert.match(app, /No se habilitan suscripciones automáticas/);
});
