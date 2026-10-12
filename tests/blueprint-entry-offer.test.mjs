import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const intake = readFileSync(new URL("../solicitar-proyecto.html", import.meta.url), "utf8");
const intakeScript = readFileSync(new URL("../project-request.js", import.meta.url), "utf8");

test("Agentic Blueprint links to a measurable, preselected intake", () => {
  const offerCard = home.match(/<article class="pricing-card reveal">[\s\S]*?Agentic Blueprint[\s\S]*?<\/article>/)?.[0];
  assert.ok(offerCard, "Agentic Blueprint pricing card exists");
  assert.match(offerCard, /US\$250/);
  assert.match(offerCard, /Mapa de procesos/);
  assert.match(offerCard, /Arquitectura objetivo/);
  assert.match(offerCard, /Backlog priorizado/);
  assert.match(offerCard, /Plan de integración/);
  assert.match(offerCard, /href="\/solicitar-proyecto\.html\?services=architecture&amp;offer_id=automation_blueprint[^\"]*utm_campaign=blueprint_entry"/);
});

test("the intake accepts the offer's service and campaign attribution", () => {
  assert.match(intake, /name="service_ids" value="architecture"/);
  assert.match(intakeScript, /preselectFromQuery\(\)/);
  assert.match(intakeScript, /utm_campaign: bounded\("utm_campaign"\)/);
  assert.match(intakeScript, /offer_id/);
});

test("offer copy does not guarantee revenue", () => {
  const offerCard = home.match(/<article class="pricing-card reveal">[\s\S]*?Agentic Blueprint[\s\S]*?<\/article>/)?.[0] || "";
  assert.doesNotMatch(offerCard, /garantiza(?:r)? ingresos|ingresos garantizados|ganancia garantizada/i);
  assert.match(offerCard, /Solicitar alcance/);
});
