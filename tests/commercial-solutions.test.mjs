import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const landing = read("soluciones-negocios.html");
const fallback = read("index.html");
const rendered = read("app.js");
const sitemap = read("sitemap.xml");
const deployment = read(".github/workflows/pages.yml");
const intake = read("project-request.js");

test("new landing page has readable Spanish, canonical and three solutions", () => {
  assert.match(landing, /lang="es"/);
  assert.match(landing, /<meta name="viewport"/);
  assert.match(landing, /rel="canonical" href="https:\/\/jadeltechrd.com\/soluciones-negocios.html"/);
  for (const term of ["Reparación de automatizaciones", "Página web y captación de consultas", "Atención y seguimiento por WhatsApp"]) {
    assert.ok(landing.includes(term), "missing: " + term);
  }
  assert.match(landing, /No incluye desarrollo ni despliegue/);
  assert.match(landing, /No implica un bot ya activo/);
  assert.match(landing, /Sin ventas garantizadas/);
});

test("all sales links use existing governed service identifiers", () => {
  const urls = [...landing.matchAll(/href="([^"]*solicitar-proyecto\.html[^"]*)"/g)].map(match => match[1].replaceAll("&amp;", "&"));
  assert.ok(urls.length >= 4, "minimum viable CTAs");
  for (const link of urls) {
    const u = new URL(link, "https://jadeltechrd.com");
    assert.equal(u.pathname, "/solicitar-proyecto.html");
    const selected = u.searchParams.get("services");
    if (selected === null) {
      assert.equal(u.search, "", "an unscoped CTA must be the plain, governed intake");
      continue;
    }
    assert.ok(["architecture", "support"].includes(selected), "unknown service " + selected);
    assert.ok(intake.includes('"' + selected + '"'), "not available in intake allowlist");
  }
});

test("both home renditions show same commercial entry and customer-friendly hero", () => {
  for (const markup of [fallback, rendered]) {
    assert.match(markup, /id="business-solutions-title"/);
    assert.match(markup, /href="\/soluciones-negocios.html"/);
    assert.match(markup, /Web, automatización e IA/);
    assert.match(markup, /sin prometer ventas/);
  }
});

test("marketing page is in sitemap and immutable Pages allowlist", () => {
  assert.match(sitemap, /https:\/\/jadeltechrd.com\/soluciones-negocios.html/);
  const staging = deployment.split("public_assets=(")[1]?.split(")")[0] ?? "";
  assert.match(staging, /\n\s+soluciones-negocios.html\n/);
  assert.match(deployment, /test "\$CONFIRMATION" = "DEPLOY_PUBLIC_SITE"/);
  assert.match(deployment, /test "\$GITHUB_SHA" = "\$EXPECTED_SHA"/);
  assert.match(landing, /form-action 'none'/);
  assert.match(landing, /script-src 'none'/);
});
