#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

REGISTRY_PATH = Path(os.environ.get("JADEL_AGENT_REGISTRY", "/app/agents.json"))
PROBE_TIMEOUT_SECONDS = float(os.environ.get("JADEL_PROBE_TIMEOUT_SECONDS", "2.5"))
STARTED_AT = time.time()


def load_registry() -> dict[str, Any]:
    with REGISTRY_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def probe(url: str | None) -> dict[str, Any]:
    if not url:
        return {"checked": False, "healthy": None}
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "jadel-agent-fleet/1"})
        with urllib.request.urlopen(request, timeout=PROBE_TIMEOUT_SECONDS) as response:
            code = int(response.status)
            body = response.read(2048).decode("utf-8", errors="replace")
        return {"checked": True, "healthy": 200 <= code < 300, "status_code": code, "body": body[:512]}
    except urllib.error.HTTPError as exc:
        return {"checked": True, "healthy": False, "status_code": int(exc.code)}
    except Exception as exc:  # bounded diagnostic; never include secrets
        return {"checked": True, "healthy": False, "error": type(exc).__name__}


def fleet_status() -> dict[str, Any]:
    registry = load_registry()
    agents: list[dict[str, Any]] = []
    required_online_healthy = True

    for configured in registry["agents"]:
        item = {
            "id": configured["id"],
            "website_service": configured["website_service"],
            "runtime_mode": configured["runtime_mode"],
            "desired_state": configured["desired_state"],
            "authority": configured["authority"],
            "deployable": configured["deployable"],
        }
        health = probe(configured.get("health_url")) if configured.get("deployable") else {"checked": False, "healthy": None}
        item["health"] = health
        if configured.get("readiness_url"):
            item["readiness"] = probe(configured["readiness_url"])
        if configured["desired_state"] == "ONLINE" and configured.get("deployable") and health.get("healthy") is not True:
            required_online_healthy = False
        agents.append(item)

    return {
        "service": "jadel-agent-fleet-control-plane",
        "version": registry["version"],
        "uptime_seconds": round(time.time() - STARTED_AT, 3),
        "policy": registry["policy"],
        "required_online_healthy": required_online_healthy,
        "agents": agents,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "JadelAgentFleet/1"

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health/live":
            self._json(200, {"live": True, "uptime_seconds": round(time.time() - STARTED_AT, 3)})
            return
        if self.path == "/health/ready":
            status = fleet_status()
            ready = bool(status["required_online_healthy"])
            self._json(200 if ready else 503, {"ready": ready})
            return
        if self.path == "/v1/agents/status":
            self._json(200, fleet_status())
            return
        self._json(404, {"error": "not_found"})

    def log_message(self, fmt: str, *args: object) -> None:
        print(json.dumps({"event": "http_access", "message": fmt % args}, separators=(",", ":")), flush=True)


def main() -> None:
    host = os.environ.get("JADEL_CONTROL_PLANE_HOST", "0.0.0.0")
    port = int(os.environ.get("JADEL_CONTROL_PLANE_PORT", "9090"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(json.dumps({"event": "control_plane_started", "host": host, "port": port}), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
