import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../automatizacion-procesos-ia-rd.html", import.meta.url), "utf8");

test("Agentic Blueprint explains distinct, verifiable measurement deliverables", () => {
  const cards = [...page.matchAll(/<article class="metric-card"><strong>(.*?)<\/strong><p>(.*?)<\/p><\/article>/g)];
  assert.deepEqual(cards.map(([, label]) => label), [
    "Tiempo manual por ciclo",
    "Errores y retrabajo",
    "Backlog priorizado por valor y riesgo",
  ]);
  const explanations = cards.map(([, , explanation]) => explanation);
  assert.equal(new Set(explanations).size, 3);
  assert.match(explanations[0], /Unidad, muestra, período y fuente/);
  assert.match(explanations[1], /categorías y reglas de conteo/);
  assert.match(explanations[2], /esfuerzo, dependencias, riesgo y valor potencial por validar/);
  assert.doesNotMatch(page, /Se define una línea base y un indicador verificable durante discovery\.<\/p><\/article><article class="metric-card">/);
});
