import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const publisher = "ca-pub-4830696678723029";
const expectedRecord = "google.com, pub-4830696678723029, DIRECT, f08c47fec0942fa0";
const publicHtml = [
  "index.html",
  "guias.html",
  "guia-automatizacion-leads.html",
  "guia-chatbot-soporte.html"
];

test("AdSense meta verification is confined to HTML head, exactly once", () => {
  for (const filename of publicHtml) {
    const html = readFileSync(filename, "utf8");
    const match = '<meta name="google-adsense-account" content="' + publisher + '">';
    assert.equal(html.split(match).length - 1, 1, filename);
    assert.ok(html.indexOf(match) < html.indexOf("</head>"), filename);
    assert.doesNotMatch(html, /adsbygoogle(?:\.js)?|pagead2\.googlesyndication\.com/, filename);
    assert.match(html, /<link rel="canonical" href="https:\/\/jadeltechrd\.com\//, filename);
  }
});

test("ads.txt declares only the supplied publisher and official seller record", () => {
  const text = readFileSync("ads.txt", "utf8");
  assert.equal(text, expectedRecord + "\n");
});

test("robots sitemap advertises only actual added educational routes", () => {
  const xml = readFileSync("sitemap.xml", "utf8");
  for (const slug of ["guias.html", "guia-automatizacion-leads.html", "guia-chatbot-soporte.html"]) {
    assert.ok(xml.includes("<loc>https://jadeltechrd.com/" + slug + "</loc>"), slug);
  }
});

test("production workflow packages publisher verification files", () => {
  const flow = readFileSync(".github/workflows/pages.yml", "utf8");
  for (const name of ["ads.txt", ...publicHtml]) {
    assert.match(flow, new RegExp("^\\s+" + name.replaceAll(".", "\\.") + "$", "m"), name);
  }
  assert.match(flow, /DEPLOY_PUBLIC_SITE/);
  assert.match(flow, /test "\$GITHUB_SHA" = "\$EXPECTED_SHA"/);
});

test("analytics consent and publisher verification do not execute ads", () => {
  const consent = readFileSync("analytics-consent.js", "utf8");
  const loader = readFileSync("ga4-loader.js", "utf8");
  assert.match(consent, /La publicidad permanece desactivada/);
  assert.match(loader, /ad_storage: "denied"/);
  assert.doesNotMatch(loader, /adsbygoogle\.js/);
});
