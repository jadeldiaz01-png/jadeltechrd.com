#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

MANIFEST = Path("config/agent-production-readiness.json")
APP = Path("app.js")
EXPECTED_PILOTS = {"sales", "social", "cineforge", "revenue", "multiagent"}
ALLOWED_DECISIONS = {"BLOCKED", "CONDITIONAL", "PRODUCTION_READY"}
ALLOWED_OWNERS = {"engineering", "human_admin", "platform", "commercial", "evidence"}
SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def fail(message: str) -> None:
    raise SystemExit(f"AGENT_PRODUCTION_READINESS=FAIL: {message}")


def catalog_statuses(js: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for service_id in EXPECTED_PILOTS:
        match = re.search(
            rf'id:\s*"{re.escape(service_id)}"[\s\S]*?status:\s*"([a-z]+)"',
            js,
        )
        if not match:
            fail(f"catalog service {service_id!r} not found in app.js")
        result[service_id] = match.group(1)
    return result


def main() -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if data.get("schema_version") != "1.0.0":
        fail("unsupported schema_version")

    policy = data.get("policy") or {}
    common_gates = policy.get("common_gates") or []
    if not common_gates or len(common_gates) != len(set(common_gates)):
        fail("common_gates must be non-empty and unique")

    services = data.get("services") or []
    ids = [service.get("id") for service in services]
    if len(ids) != len(set(ids)):
        fail("duplicate service ids")
    if set(ids) != EXPECTED_PILOTS:
        fail(f"pilot set drift: expected {sorted(EXPECTED_PILOTS)}, got {sorted(set(ids))}")

    app_status = catalog_statuses(APP.read_text(encoding="utf-8"))
    score_lines: list[str] = []

    for service in services:
        sid = service["id"]
        decision = service.get("decision")
        if decision not in ALLOWED_DECISIONS:
            fail(f"{sid}: invalid decision {decision!r}")
        if service.get("target_status") != "PRODUCTION_READY":
            fail(f"{sid}: target_status must remain PRODUCTION_READY")
        sha = service.get("source_sha", "")
        if not SHA_RE.fullmatch(sha):
            fail(f"{sid}: source_sha must be an exact 40-char lowercase SHA")
        if app_status[sid] != service.get("catalog_status"):
            fail(
                f"{sid}: app.js status={app_status[sid]!r} disagrees with "
                f"manifest catalog_status={service.get('catalog_status')!r}"
            )

        gates = service.get("gates") or {}
        missing = [gate for gate in common_gates if gate not in gates]
        extra = [gate for gate in gates if gate not in common_gates]
        if missing or extra:
            fail(f"{sid}: common gate mismatch missing={missing} extra={extra}")
        if any(type(value) is not bool for value in gates.values()):
            fail(f"{sid}: every common gate must be boolean")

        specific = service.get("service_specific_gates") or {}
        if not specific or any(type(value) is not bool for value in specific.values()):
            fail(f"{sid}: service_specific_gates must be non-empty booleans")

        blockers = service.get("blocking_gates") or []
        for blocker in blockers:
            if blocker.get("owner") not in ALLOWED_OWNERS:
                fail(f"{sid}: invalid blocker owner {blocker.get('owner')!r}")
            if not blocker.get("id") or not blocker.get("reason"):
                fail(f"{sid}: blocker missing id/reason")

        total = len(gates) + len(specific)
        passed = sum(gates.values()) + sum(specific.values())
        score = round((passed / total) * 100)
        score_lines.append(f"{sid}: {passed}/{total} gates = {score}% decision={decision}")

        if decision == "PRODUCTION_READY":
            if blockers:
                fail(f"{sid}: production-ready service cannot have blocking_gates")
            if not all(gates.values()) or not all(specific.values()):
                fail(f"{sid}: production-ready service has false gates")
            if service.get("catalog_status") != "available":
                fail(f"{sid}: production-ready service must be catalog_status=available")
        else:
            if service.get("catalog_status") == "available":
                fail(f"{sid}: non-production decision cannot be catalog_status=available")
            if not blockers:
                fail(f"{sid}: blocked/conditional service must explain at least one blocker")

    print("AGENT_PRODUCTION_READINESS=PASS")
    print("PILOT_SERVICES=5")
    for line in score_lines:
        print(line)


if __name__ == "__main__":
    main()
