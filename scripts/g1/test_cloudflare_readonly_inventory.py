"""Synthetic offline tests; no network, Cloudflare credentials, or D1 writes."""
import os
import unittest
from unittest.mock import patch
from cloudflare_readonly_inventory import Blocked, Reader, validate_inventory

ACCOUNT = "f" * 32
ROOT = "/accounts/" + ACCOUNT
PROD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
STAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
PROD = "jadel-commercial-runtime"
STAGE = "jadel-commercial-runtime-staging"
STAGE_DB = "jadel-commercial-runtime-staging"


def fixture(stage_id=STAGE_ID, stage_worker=STAGE,
            active=True, deploy=True, secret=True):
    def bindings(db):
        out = [{"type": "d1", "name": "DB", "id": db}]
        if secret:
            out.append({"type": "secret_text", "name": "TURNSTILE_SECRET_KEY"})
        out.extend([
            {"type": "plain_text", "name": "PUBLIC_TURNSTILE_SITEKEY"},
            {"type": "plain_text", "name": "TURNSTILE_EXPECTED_HOSTNAME"},
        ])
        return {"success": True, "result": {"bindings": out}}

    results = {
        ROOT + "/tokens/verify": {
            "success": True,
            "result": {"status": "active" if active else "expired"}},
        ROOT + "/workers/scripts": {
            "success": True, "result": [{"id": PROD}, {"id": stage_worker}]},
        ROOT + "/d1/database?per_page=100&page=1": {
            "success": True,
            "result": [{"uuid": PROD_ID, "name": PROD},
                       {"uuid": STAGE_ID, "name": STAGE_DB}],
            "result_info": {"total_count": 2}},
        ROOT + "/workers/scripts/" + PROD + "/settings": bindings(PROD_ID),
        ROOT + "/workers/scripts/" + stage_worker + "/settings": bindings(stage_id),
        ROOT + "/d1/database/" + STAGE_ID: {
            "success": True, "result": {"uuid": STAGE_ID, "name": STAGE_DB}},
        ROOT + "/workers/scripts/" + stage_worker + "/deployments": {
            "success": True,
            "result": {"deployments": [{"id": "synthetic-only"}] if deploy else []}},
    }

    def get(path):
        if path not in results:
            raise Blocked("UNEXPECTED_API_GET")
        return results[path]
    return get


class InventoryTests(unittest.TestCase):
    def test_isolated_worker_database_and_deployment(self):
        result = validate_inventory(fixture(), ACCOUNT)
        self.assertEqual(result["decision"], "INVENTORY_ISOLATION_PASS_NOT_G1_CERTIFICATION")
        self.assertEqual(result["staging_worker"], STAGE)
        self.assertEqual(result["staging_d1_name"], STAGE_DB)
        self.assertTrue(result["account_token_active"])
        self.assertFalse(result["g1_certified"])
        self.assertNotIn(STAGE_ID, str(result))
        self.assertNotIn(ACCOUNT, str(result))

    def test_block_production_d1_binding(self):
        with self.assertRaisesRegex(Blocked, "STAGING_POINTS_TO_PRODUCTION_D1"):
            validate_inventory(fixture(stage_id=PROD_ID), ACCOUNT)

    def test_block_unknown_staging_worker(self):
        with self.assertRaisesRegex(Blocked, "STAGING_WORKER_MISSING_OR_AMBIGUOUS"):
            validate_inventory(fixture(stage_worker="unrelated"), ACCOUNT)

    def test_block_expired_token(self):
        with self.assertRaisesRegex(Blocked, "ACCOUNT_TOKEN_NOT_ACTIVE"):
            validate_inventory(fixture(active=False), ACCOUNT)

    def test_block_missing_deployment(self):
        with self.assertRaisesRegex(Blocked, "STAGING_WORKER_NO_ACTIVE_DEPLOYMENT"):
            validate_inventory(fixture(deploy=False), ACCOUNT)

    def test_block_expected_d1_mismatch(self):
        with self.assertRaisesRegex(Blocked, "EXPECTED_STAGING_D1_MISMATCH"):
            validate_inventory(fixture(), ACCOUNT, expected_d1="different-staging")

    def test_missing_turnstile_secret_does_not_certify_g1(self):
        result = validate_inventory(fixture(secret=False), ACCOUNT)
        self.assertFalse(result["turnstile_secret_binding_present"])
        self.assertFalse(result["g1_certified"])

    def test_reject_missing_credentials(self):
        with self.assertRaisesRegex(Blocked, "MISSING_OR_INVALID_SCOPED_CREDENTIAL"):
            Reader("", "not-used")
        with self.assertRaisesRegex(Blocked, "MISSING_OR_INVALID_SCOPED_CREDENTIAL"):
            Reader(ACCOUNT, "")

    def test_reject_non_account_scoped_paths(self):
        reader = Reader(ACCOUNT, "synthetic-test-token")
        for path in ("/zones", "/accounts/other/workers/scripts",
                     ROOT + "/../zones", ROOT + "/https://evil.invalid"):
            with self.assertRaisesRegex(Blocked, "NON_ACCOUNT_SCOPED_PATH"):
                reader.get(path)


if __name__ == "__main__":
    unittest.main()
