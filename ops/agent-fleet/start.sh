#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
RUNTIME_ENV="/etc/jadel-agent-fleet/runtime.env"

if [ -f "$RUNTIME_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$RUNTIME_ENV"
  set +a
fi

export JADEL_SOURCES_DIR="${JADEL_SOURCES_DIR:-/opt/jadel-agent-fleet/sources}"
export OPENAI_MODEL="${OPENAI_MODEL:-gpt-5.6-luna}"

docker compose -f "$COMPOSE_FILE" up -d --remove-orphans control-plane support-tickets aureus

if [ "${ENABLE_CHATBOT:-false}" = "true" ]; then
  : "${OPENAI_API_KEY:?OPENAI_API_KEY is required when ENABLE_CHATBOT=true}"
  docker compose -f "$COMPOSE_FILE" --profile chatbot up -d chatbot
else
  docker compose -f "$COMPOSE_FILE" --profile chatbot stop chatbot >/dev/null 2>&1 || true
fi

echo 'JADEL_AGENT_FLEET_START=PASS'
