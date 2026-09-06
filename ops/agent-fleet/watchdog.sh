#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
export JADEL_SOURCES_DIR="${JADEL_SOURCES_DIR:-/opt/jadel-agent-fleet/sources}"

check_and_recover() {
  local service="$1" url="$2"
  if curl --fail --silent --show-error --max-time 3 "$url" >/dev/null; then
    echo "WATCHDOG_HEALTH=PASS service=$service"
    return 0
  fi
  echo "WATCHDOG_HEALTH=FAIL service=$service action=restart"
  docker compose -f "$COMPOSE_FILE" restart "$service"
  sleep 5
  curl --fail --silent --show-error --max-time 3 "$url" >/dev/null || {
    echo "WATCHDOG_RECOVERY=FAIL service=$service" >&2
    return 1
  }
  echo "WATCHDOG_RECOVERY=PASS service=$service"
}

failures=0
check_and_recover control-plane 'http://127.0.0.1:9090/health/live' || failures=$((failures + 1))
check_and_recover support-tickets 'http://127.0.0.1:8501/_stcore/health' || failures=$((failures + 1))
check_and_recover aureus 'http://127.0.0.1:8000/health/live' || failures=$((failures + 1))

if [ "${ENABLE_CHATBOT:-false}" = "true" ]; then
  check_and_recover chatbot 'http://127.0.0.1:8502/_stcore/health' || failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  echo "JADEL_AGENT_FLEET_WATCHDOG=DEGRADED failures=$failures" >&2
  exit 70
fi

echo 'JADEL_AGENT_FLEET_WATCHDOG=PASS'
