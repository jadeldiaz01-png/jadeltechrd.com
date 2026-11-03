import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const intake = readFileSync(new URL("../solicitar-proyecto.html", import.meta.url), "utf8");
const intakeScript = readFileSync(new URL("../project-request.js", import.meta.url), "utf8");

const start = app.indexOf("const homeMarkup = `");
const end = app.indexOf("\n    </section>`;", start);
assert.ok(start >= 0 && end > start, "rendered home template exists");
const renderedHome = app.slice(start, end);

for (const [label, markup] of [["static", home], ["JavaScript-rendered", renderedHome]]) {
  test(`${label} Blueprint offer shows fixed scope, price hypothesis, and measurable intake`, () => {
    const offer = markup.match(/<article class="pricing-card reveal">[\s\S]*?Agentic Blueprint[\s\S]*?<\/article>/)?.[0];
    assert.ok(offer, "Blueprint pricing card exists");
    assert.match(offer, /US\$250/);
    assert.match(offer, /Un proceso priorizado por impacto, coste, viabilidad y controles/);
    assert.match(offer, /Mapa breve del flujo/);
    assert.match(offer, /Arquitectura recomendada/);
    assert.match(offer, /Backlog priorizado/);
    assert.match(offer, /Hasta 2\.5 horas de trabajo/);
    assert.match(offer, /data-cta-id="homepage_blueprint_pricing"/);
    assert.match(offer, /href="\/solicitar-proyecto\.html\?services=architecture&amp;offer_id=automation_blueprint&amp;service_id=architecture&amp;utm_content=homepage_blueprint_pricing"/);
    assert.doesNotMatch(offer, /garantiza(?:r)? ingresos|ingresos garantizados|ganancia garantizada/i);
  });
}

test("intake preselects the Blueprint service and filters acquisition attribution", () => {
  assert.match(intake, /name="service_ids" value="architecture"/);
  assert.match(intakeScript, /preselectFromQuery\(\)/);
  assert.match(intakeScript, /utm_campaign: utm\("utm_campaign"\)/);
  assert.match(intakeScript, /offer_id/);
});
