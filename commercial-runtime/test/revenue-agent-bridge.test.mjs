import test from "node:test";
import assert from "node:assert/strict";
import {
  loadApprovedOpportunityFeed,
  normalizeApprovedOpportunity,
} from "../src/revenue-agent-bridge.mjs";

test("normalizer emits no PII and no execution authority", () => {
  const item = normalizeApprovedOpportunity({
    project_id:"11111111-1111-1111-1111-111111111111",
    service_ids_json:'["revenue","analytics"]',
    state:"POLICY_ALLOWED",
    policy_status:"ALLOWED",
    name:"Sensitive Name",
    email:"sensitive@example.com",
    notes:"secret",
    created_at:"2026-09-23T00:00:00Z",
    updated_at:"2026-09-23T00:01:00Z",
  });
  assert.equal(item.pii_included, false);
  assert.equal(item.authority.financial_execution_authorized, false);
  assert.equal(item.authority.external_submission_authorized, false);
  const serialized = JSON.stringify(item);
  assert.equal(serialized.includes("Sensitive Name"), false);
  assert.equal(serialized.includes("sensitive@example.com"), false);
  assert.equal(serialized.includes("secret"), false);
});

test("non-approved rows are excluded", () => {
  const item = normalizeApprovedOpportunity({
    project_id:"11111111-1111-1111-1111-111111111111",
    policy_status:"PENDING",
  });
  assert.equal(item, null);
});

test("feed uses an allowlisted non-PII projection", async () => {
  let sqlSeen = "";
  let limitSeen = null;
  const db = {
    prepare(sql) {
      sqlSeen = sql;
      return {
        bind(limit) {
          limitSeen = limit;
          return {
            async all() {
              return {
                results:[{
                  project_id:"11111111-1111-1111-1111-111111111111",
                  service_ids_json:'["revenue"]',
                  state:"POLICY_ALLOWED",
                  policy_status:"ALLOWED",
                  created_at:"2026-09-23T00:00:00Z",
                  updated_at:"2026-09-23T00:01:00Z",
                }]
              };
            }
          };
        }
      };
    }
  };
  const feed = await loadApprovedOpportunityFeed(db, 500);
  assert.equal(limitSeen, 100);
  assert.match(sqlSeen, /^SELECT project_id,service_ids_json,state,policy_status,created_at,updated_at FROM project_requests/);
  assert.equal(/name|email|company|notes/i.test(sqlSeen), false);
  assert.equal(feed.count, 1);
  assert.equal(feed.production_execution_authorized, false);
  assert.equal(feed.pii_included, false);
});
