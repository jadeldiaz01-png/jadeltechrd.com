import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../approval-console.js", import.meta.url), "utf8");

test("approval console renders commercial lifecycle controls only after policy approval", () => {
  assert.match(source, /LEAD_LIFECYCLE_URL.*\/api\/v1\/admin\/lead-lifecycle/);
  assert.match(source, /function leadLifecycleControls\(project\)/);
  assert.match(source, /data-lead-stage=/);
  const quotableStart = source.indexOf("quotableProjects.map");
  const renderedControls = source.indexOf("${leadLifecycleControls(project)}");
  assert.notEqual(quotableStart, -1);
  assert.notEqual(renderedControls, -1);
  assert.ok(renderedControls > quotableStart);
  assert.equal(source.slice(0, quotableStart).includes("${leadLifecycleControls(project)}"), false);
});

test("approval console sends only lifecycle identifiers and retries with the same idempotency key", () => {
  assert.match(source, /const leadLifecycleEventIds = new Map\(\)/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /source_event_id:\s*sourceEventId/);
  assert.match(source, /project_id:\s*projectId,\s*stage,\s*source_event_id:/);
  assert.doesNotMatch(source, /email:.*source_event_id|notes:.*source_event_id/);
});
