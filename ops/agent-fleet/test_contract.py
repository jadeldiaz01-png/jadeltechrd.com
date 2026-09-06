#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
REGISTRY = json.loads((ROOT / "agents.json").read_text(encoding="utf-8"))

assert REGISTRY["version"] == 1
policy = REGISTRY["policy"]
assert policy["default_deny_external_side_effects"] is True
assert policy["live_capital_enabled"] is False
assert policy["autonomous_publication_enabled"] is False
assert policy["autonomous_marketplace_submission_enabled"] is False
assert policy["human_approval_for_irreversible_actions"] is True

agents = REGISTRY["agents"]
assert len(agents) == 11, f"expected 11 website service entries, got {len(agents)}"
ids = [agent["id"] for agent in agents]
assert len(ids) == len(set(ids)), "agent ids must be unique"

expected = {
    "control-plane", "support-tickets", "chatbot", "social-intelligence", "cineforge",
    "meta-integration", "decision-intelligence", "aureus", "aegis-quant",
    "governance", "multi-agent-orchestration",
}
assert set(ids) == expected

by_id = {agent["id"]: agent for agent in agents}
sha_re = re.compile(r"^[0-9a-f]{40}$")
for agent in agents:
    assert agent["authority"], agent["id"]
    if agent.get("repository") and agent.get("source_sha"):
        assert sha_re.fullmatch(agent["source_sha"]), f"mutable or invalid source ref for {agent['id']}"

    if not agent.get("deployable"):
        continue

    assert agent.get("health_url"), f"deployable service {agent['id']} needs health URL"
    shared_runtime = agent.get("runtime_service")
    if shared_runtime:
        assert shared_runtime != agent["id"], f"shared runtime cannot self-reference for {agent['id']}"
        assert shared_runtime in by_id, f"unknown shared runtime {shared_runtime} for {agent['id']}"
        target = by_id[shared_runtime]
        assert target.get("deployable") is True, f"shared runtime target {shared_runtime} must be deployable"
        assert agent["health_url"] == target.get("health_url"), f"shared health drift for {agent['id']}"
        continue

    if agent["id"] != "control-plane":
        assert agent.get("repository"), f"deployable service {agent['id']} needs repository"
        assert sha_re.fullmatch(agent.get("source_sha", "")), f"deployable service {agent['id']} must be SHA-pinned"

assert by_id["aegis-quant"]["authority"] == "NO_LIVE_CAPITAL"
assert by_id["aureus"]["desired_state"] != "ONLINE"
assert "NO_PAYMENT" in by_id["aureus"]["authority"]
assert "NO_AUTO_PUBLISH" in by_id["cineforge"]["authority"]
assert "NO_AUTONOMOUS_OUTREACH" in by_id["chatbot"]["authority"]
assert by_id["governance"]["runtime_service"] == "control-plane"

bootstrap = (ROOT / "bootstrap.sh").read_text(encoding="utf-8")
for service_id in ("support-tickets", "chatbot", "aureus"):
    sha = by_id[service_id]["source_sha"]
    assert sha in bootstrap, f"bootstrap pin drift for {service_id}"

compose = (ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")
for service in ("control-plane:", "support-tickets:", "chatbot:", "aureus:"):
    assert service in compose
assert "restart: unless-stopped" in compose
assert "no-new-privileges:true" in compose
assert "OPENAI_API_KEY: ${OPENAI_API_KEY:-}" in compose
assert "OPENAI_API_KEY: ${OPENAI_API_KEY:?" not in compose

start_script = (ROOT / "start.sh").read_text(encoding="utf-8")
assert 'ENABLE_CHATBOT:-false' in start_script
assert 'OPENAI_API_KEY:?OPENAI_API_KEY is required when ENABLE_CHATBOT=true' in start_script

deploy = (REPO_ROOT / ".github" / "workflows" / "agent-fleet-deploy.yml").read_text(encoding="utf-8")
assert "EXPECTED_SHA: ${{ inputs.expected_sha }}" in deploy
assert "[[ ! \"$EXPECTED_SHA\" =~ ^[0-9a-f]{40}$ ]]" in deploy
assert "+refs/heads/main:refs/remotes/origin/main" in deploy
assert 'test "$main_sha" = "$EXPECTED_SHA"' in deploy
assert "test \"$actual\" = '${{ inputs.expected_sha }}'" not in deploy
assert "persist-credentials: false" in deploy

print("JADEL_AGENT_FLEET_CONTRACT=PASS")
