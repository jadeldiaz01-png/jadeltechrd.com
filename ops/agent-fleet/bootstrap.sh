#!/usr/bin/env bash
set -euo pipefail

FLEET_HOME="${JADEL_FLEET_HOME:-/opt/jadel-agent-fleet}"
SOURCES_DIR="${JADEL_SOURCES_DIR:-${FLEET_HOME}/sources}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"

SUPPORT_REPO='https://github.com/jadeldiaz01-png/support-tickets.git'
SUPPORT_SHA='894082e7f0717fc7e7407c07a927bcb813a5286e'
CHATBOT_REPO='https://github.com/jadeldiaz01-png/chatbot.git'
CHATBOT_SHA='27d6c202905d73dd417c38c75c083ade5ae26278'
AUREUS_REPO='https://github.com/jadeldiaz01-png/AUREUS-2026-Autonomous-Universal-Revenue-Efficient-Utility-Scheduler.git'
AUREUS_SHA='3cb0455194f2861ae69e219fcd0f5affe5095dd9'

command -v git >/dev/null
command -v docker >/dev/null
docker compose version >/dev/null

install -d -m 0755 "$FLEET_HOME" "$SOURCES_DIR"

sync_source() {
  local name="$1" repo="$2" sha="$3" dest="$SOURCES_DIR/$name"
  if [ ! -d "$dest/.git" ]; then
    git clone --filter=blob:none "$repo" "$dest"
  fi
  git -C "$dest" fetch --prune origin "$sha"
  git -C "$dest" checkout --detach "$sha"
  actual="$(git -C "$dest" rev-parse HEAD)"
  if [ "$actual" != "$sha" ]; then
    echo "SOURCE_SHA_MISMATCH name=$name expected=$sha actual=$actual" >&2
    exit 31
  fi
  if [ -n "$(git -C "$dest" status --porcelain)" ]; then
    echo "SOURCE_TREE_DIRTY name=$name" >&2
    exit 32
  fi
  echo "SOURCE_PINNED name=$name sha=$sha"
}

sync_source support-tickets "$SUPPORT_REPO" "$SUPPORT_SHA"
sync_source chatbot "$CHATBOT_REPO" "$CHATBOT_SHA"
sync_source aureus "$AUREUS_REPO" "$AUREUS_SHA"

export JADEL_SOURCES_DIR="$SOURCES_DIR"

docker compose -f "$COMPOSE_FILE" config >/dev/null
docker compose -f "$COMPOSE_FILE" build --pull control-plane support-tickets aureus

docker compose -f "$COMPOSE_FILE" up -d --remove-orphans control-plane support-tickets aureus

if [ "${ENABLE_CHATBOT:-false}" = "true" ]; then
  : "${OPENAI_API_KEY:?OPENAI_API_KEY is required when ENABLE_CHATBOT=true}"
  docker compose -f "$COMPOSE_FILE" --profile chatbot build --pull chatbot
  docker compose -f "$COMPOSE_FILE" --profile chatbot up -d chatbot
else
  echo 'CHATBOT_RUNTIME=CONTAINER_QUALIFIED_CONFIG_NOT_ENABLED'
fi

wait_http() {
  local name="$1" url="$2"
  for _ in $(seq 1 60); do
    if curl --fail --silent --show-error --max-time 3 "$url" >/dev/null; then
      echo "HEALTH_PASS name=$name url=$url"
      return 0
    fi
    sleep 2
  done
  echo "HEALTH_FAIL name=$name url=$url" >&2
  return 1
}

wait_http support-tickets 'http://127.0.0.1:8501/_stcore/health'
wait_http aureus-live 'http://127.0.0.1:8000/health/live'
wait_http control-plane 'http://127.0.0.1:9090/health/live'

if [ "${ENABLE_CHATBOT:-false}" = "true" ]; then
  wait_http chatbot 'http://127.0.0.1:8502/_stcore/health'
fi

curl --fail --silent --show-error 'http://127.0.0.1:9090/v1/agents/status'
echo
echo 'JADEL_AGENT_FLEET_BOOTSTRAP=PASS'
echo 'LIVE_CAPITAL_ENABLED=false'
echo 'AUTONOMOUS_PUBLICATION_ENABLED=false'
echo 'AUTONOMOUS_MARKETPLACE_SUBMISSION_ENABLED=false'
