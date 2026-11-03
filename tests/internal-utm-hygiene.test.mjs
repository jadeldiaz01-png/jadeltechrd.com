import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const files = [...readdirSync(root), "commercial-runtime/src/validation.mjs"]
  .filter((path) => /\.html$|\.js$/.test(path));

test("internal navigation links do not label the site itself as an acquisition source", () => {
  const violations = [];
  for (const file of files) {
    const source = readFileSync(new URL(file, root), "utf8");
    for (const match of source.matchAll(/href="\/[^"]*utm_(?:source|medium|campaign)=[^"]*"/g)) {
      violations.push(`${file}: ${match[0]}`);
    }
    for (const match of source.matchAll(/href="\$\{[^\"]+\}[^"]*utm_(?:source|medium|campaign)=[^"]*"/g)) {
      violations.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(violations, []);
});
