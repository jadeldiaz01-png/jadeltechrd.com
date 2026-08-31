import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateProjectRequest } from "../src/validation.mjs";

test("hostile text remains data and SQL writes use bound placeholders", async () => {
  const payload = validateProjectRequest({
    name: "Robert'); DROP TABLE project_requests;--",
    email: "safe@example.com",
    company: "x' OR 1=1 --",
    service_ids: ["architecture"],
    notes: "<script>alert(1)</script>",
    locale: "es-DO",
    turnstile_token: "test-token"
  });
  assert.equal(payload.serviceIds[0], "architecture");
  const source = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");
  assert.match(source, /VALUES \(\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?\)/);
  assert.doesNotMatch(source, /INSERT INTO project_requests[\s\S]*\$\{input\./);
});
