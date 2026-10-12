import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const servicePage = readFileSync(new URL("../automatizacion-procesos-ia-rd.html", import.meta.url), "utf8");

function jsonLd(document) {
  return [...document.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)]
    .map(([, source]) => JSON.parse(source));
}

test("homepage identifies only the visible organization facts", () => {
  const [organization] = jsonLd(home);
  assert.equal(organization["@type"], "Organization");
  assert.equal(organization["@id"], "https://jadeltechrd.com/#organization");
  assert.equal(organization.name, "Jadel Tech RD");
  assert.equal(organization.url, "https://jadeltechrd.com/");
  assert.deepEqual(Object.keys(organization).sort(), ["@context", "@id", "@type", "name", "url"].sort());
});

test("Agentic Blueprint service markup matches visible page content", () => {
  const [service] = jsonLd(servicePage);
  const description = servicePage.match(/<meta name="description" content="([^"]+)"/)?.[1];
  const title = servicePage.match(/<h1>([^<]+)<\/h1>/)?.[1];
  assert.equal(service["@type"], "Service");
  assert.equal(service.name, title);
  assert.equal(service.description, description);
  assert.equal(service.url, "https://jadeltechrd.com/automatizacion-procesos-ia-rd.html");
  assert.equal(service.provider["@id"], "https://jadeltechrd.com/#organization");
  assert.ok(!("offers" in service));
  assert.ok(!("aggregateRating" in service));
});
