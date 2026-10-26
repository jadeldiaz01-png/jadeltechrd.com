#!/usr/bin/env python3
"""G1 Cloudflare inventory preflight: authenticated GET only, fail closed.

This script does not run G1 synthetic requests, D1 SQL, deployments or mutations.
Never prints tokens, full account IDs, D1 UUIDs, or API response bodies.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener

BASE = "https://api.cloudflare.com/client/v4"
ACCOUNT_RE = re.compile(r"^[0-9a-fA-F]{32}$")
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$")
WORKER_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
STAGE_RE = re.compile(r"(?:^|[-_])(?:staging|stage|test|sandbox)(?:$|[-_])", re.I)
PROD_NAME = "jadel-commercial-runtime"
RECOVERY_NAME = "jadel-commercial-runtime-recovery-drill"
MAX_BODY = 1024 * 1024


class Blocked(Exception):
    pass


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.lower().encode()).hexdigest()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Blocked("CLOUDFLARE_REDIRECT_REJECTED")


class Reader:
    def __init__(self, account: str, token: str):
        if not ACCOUNT_RE.fullmatch(account) or not token:
            raise Blocked("MISSING_OR_INVALID_SCOPED_CREDENTIAL")
        self.account = account
        self.token = token
        self.opener = build_opener(NoRedirect)

    def get(self, route: str) -> dict:
        prefix = "/accounts/" + self.account + "/"
        if not route.startswith(prefix) or ".." in route or "://" in route:
            raise Blocked("NON_ACCOUNT_SCOPED_PATH")
        req = Request(BASE + route, headers={
            "Authorization": "Bearer " + self.token,
            "Accept": "application/json",
        }, method="GET")
        try:
            with self.opener.open(req, timeout=15) as response:
                if response.status != 200:
                    raise Blocked("CLOUDFLARE_HTTP_NOT_200")
                raw = response.read(MAX_BODY + 1)
            if len(raw) > MAX_BODY:
                raise Blocked("CLOUDFLARE_RESPONSE_TOO_LARGE")
            doc = json.loads(raw)
        except HTTPError as e:
            raise Blocked("CLOUDFLARE_HTTP_" + str(e.code)) from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise Blocked("CLOUDFLARE_NETWORK_OR_JSON_FAILURE") from None
        if not isinstance(doc, dict) or doc.get("success") is not True:
            raise Blocked("CLOUDFLARE_API_SUCCESS_NOT_TRUE")
        return doc


def validate_inventory(get, account: str, expected_worker: str = "",
                       expected_d1: str = "") -> dict:
    root = "/accounts/" + account
    verify = get(root + "/tokens/verify").get("result")
    if not isinstance(verify, dict) or verify.get("status") != "active":
        raise Blocked("ACCOUNT_TOKEN_NOT_ACTIVE")

    worker_list = get(root + "/workers/scripts").get("result")
    if not isinstance(worker_list, list):
        raise Blocked("WORKER_LIST_BAD_SCHEMA")
    names = [entry.get("id") for entry in worker_list if isinstance(entry, dict)]
    names = [name for name in names if isinstance(name, str)]
    if PROD_NAME not in names:
        raise Blocked("PRODUCTION_WORKER_NOT_VISIBLE")
    candidates = [name for name in names if STAGE_RE.search(name) and name != PROD_NAME]
    if expected_worker:
        if not WORKER_RE.fullmatch(expected_worker) or not STAGE_RE.search(expected_worker):
            raise Blocked("BAD_EXPECTED_STAGING_WORKER")
        candidates = [name for name in candidates if name == expected_worker]
    if len(candidates) != 1:
        raise Blocked("STAGING_WORKER_MISSING_OR_AMBIGUOUS")
    worker = candidates[0]

    database_rows = []
    for page in range(1, 51):
        doc = get(root + "/d1/database?per_page=100&page=" + str(page))
        rows = doc.get("result")
        if not isinstance(rows, list):
            raise Blocked("D1_LIST_BAD_SCHEMA")
        database_rows.extend(rows)
        info = doc.get("result_info")
        total = info.get("total_count") if isinstance(info, dict) else None
        if isinstance(total, int) and len(database_rows) >= total:
            break
        if len(rows) < 100:
            break
    else:
        raise Blocked("D1_PAGINATION_LIMIT")

    by_uuid = {}
    for db in database_rows:
        if not isinstance(db, dict):
            raise Blocked("D1_ENTRY_BAD_SCHEMA")
        uid, name = db.get("uuid"), db.get("name")
        if not isinstance(uid, str) or not UUID_RE.fullmatch(uid) or not isinstance(name, str):
            raise Blocked("D1_IDENTITY_BAD_SCHEMA")
        if uid.lower() in by_uuid:
            raise Blocked("D1_DUPLICATE_UUID")
        by_uuid[uid.lower()] = db

    prod_records = [db for db in by_uuid.values() if db.get("name") == PROD_NAME]
    if len(prod_records) != 1:
        raise Blocked("PRODUCTION_D1_IDENTITY_NOT_UNIQUE")
    prod_uuid = prod_records[0]["uuid"].lower()

    def get_bindings(worker_name: str) -> list:
        resp = get(root + "/workers/scripts/" + quote(worker_name, safe="") + "/settings")
        obj = resp.get("result")
        bindings = obj.get("bindings") if isinstance(obj, dict) else None
        if not isinstance(bindings, list):
            raise Blocked("WORKER_BINDINGS_UNAVAILABLE")
        return bindings

    def db_uuid(bindings: list) -> str:
        found = [b for b in bindings if isinstance(b, dict)
                 and b.get("name") == "DB" and b.get("type") == "d1"]
        if len(found) != 1:
            raise Blocked("DB_BINDING_NOT_UNIQUE")
        uid = found[0].get("id") or found[0].get("database_id")
        if not isinstance(uid, str) or not UUID_RE.fullmatch(uid):
            raise Blocked("DB_BINDING_UUID_INVALID")
        return uid.lower()

    stage_bindings = get_bindings(worker)
    stage_uuid = db_uuid(stage_bindings)
    prod_binding_uuid = db_uuid(get_bindings(PROD_NAME))
    if prod_binding_uuid != prod_uuid:
        raise Blocked("PRODUCTION_WORKER_D1_MISMATCH")
    if stage_uuid == prod_uuid:
        raise Blocked("STAGING_POINTS_TO_PRODUCTION_D1")
    stage_record = by_uuid.get(stage_uuid)
    if not stage_record:
        raise Blocked("STAGING_D1_NOT_VISIBLE")
    stage_name = stage_record["name"]
    if stage_name == RECOVERY_NAME or not STAGE_RE.search(stage_name):
        raise Blocked("STAGING_D1_IDENTITY_NOT_ISOLATED")
    if expected_d1 and stage_name != expected_d1:
        raise Blocked("EXPECTED_STAGING_D1_MISMATCH")

    detail = get(root + "/d1/database/" + stage_uuid).get("result")
    if not isinstance(detail, dict) or str(detail.get("uuid", "")).lower() != stage_uuid or detail.get("name") != stage_name:
        raise Blocked("STAGING_D1_DETAILS_MISMATCH")
    deployment = get(root + "/workers/scripts/" + quote(worker, safe="") + "/deployments").get("result")
    deployments = deployment.get("deployments") if isinstance(deployment, dict) else None
    if not isinstance(deployments, list) or not deployments:
        raise Blocked("STAGING_WORKER_NO_ACTIVE_DEPLOYMENT_EVIDENCE")

    secrets = {b.get("name") for b in stage_bindings if isinstance(b, dict)
               and b.get("type") in {"secret_text", "secret_key"}}
    public = {b.get("name") for b in stage_bindings if isinstance(b, dict)}
    return {
        "gate": "G1_CLOUDFLARE_INVENTORY",
        "decision": "INVENTORY_ISOLATION_PASS_NOT_G1_CERTIFICATION",
        "staging_worker": worker,
        "staging_d1_name": stage_name,
        "staging_d1_uuid_sha256": fingerprint(stage_uuid),
        "production_d1_uuid_sha256": fingerprint(prod_uuid),
        "account_id_sha256": fingerprint(account),
        "account_token_active": True,
        "workers_read": True,
        "d1_read": True,
        "staging_worker_deployments_listed": True,
        "turnstile_secret_binding_present": "TURNSTILE_SECRET_KEY" in secrets,
        "turnstile_public_bindings_present": {"PUBLIC_TURNSTILE_SITEKEY", "TURNSTILE_EXPECTED_HOSTNAME"}.issubset(public),
        "workflow_source_sha": os.environ.get("GITHUB_SHA", "LOCAL_TEST_NO_SHA"),
        "staging_deployed_source_sha": "NOT_VERIFIED",
        "token_write_permission_absent": "NOT_VERIFIED_BY_GET",
        "g1_test_artifacts": "NOT_VERIFIED",
        "pii_and_no_production_writes": "NOT_VERIFIED",
        "independent_review": "NOT_VERIFIED",
        "g1_certified": False,
    }


def main() -> int:
    try:
        reader = Reader(os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip(),
                        os.environ.get("CLOUDFLARE_G1_READ_TOKEN", "").strip())
        output = validate_inventory(reader.get, reader.account,
                                    os.environ.get("G1_EXPECTED_STAGING_WORKER", "").strip(),
                                    os.environ.get("G1_EXPECTED_STAGING_D1", "").strip())
        print(json.dumps(output, sort_keys=True))
        return 0
    except Blocked as err:
        print("G1_CLOUDFLARE_INVENTORY=BLOCKED_" + str(err))
        return 2


if __name__ == "__main__":
    sys.exit(main())
