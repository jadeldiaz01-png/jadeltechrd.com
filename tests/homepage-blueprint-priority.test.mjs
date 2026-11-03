import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("app.js", root), "utf8");
const start = app.indexOf('const homeMarkup = `');
const end = app.indexOf("\n    </section>`;", start);
assert.ok(start >= 0 && end > start, "JavaScript-rendered homepage template exists");
const rendered = app.slice(start, end);

for (const [label, source] of [["static", html], ["JavaScript-rendered", rendered]]) {
  test(`${label} homepage puts the Blueprint before services and sends its CTA straight to intake`, () => {
    const offer = source.indexOf('id="blueprint-alcance"');
    const services = source.indexOf('id="servicios"');
    assert.ok(offer >= 0 && services > offer, "Blueprint scope precedes the service catalog");
    const hero = source.match(/data-cta-id="homepage_blueprint_entry"[^>]*href="([^"]+)"/);
    assert.ok(hero, "primary Blueprint CTA exists");
    assert.match(hero[1], /^\/solicitar-proyecto\.html\?services=architecture&amp;offer_id=automation_blueprint/);
    assert.doesNotMatch(hero[1], /utm_source=(?:website|homepage)|utm_medium=homepage|utm_campaign=blueprint_entry/);
  });
}
