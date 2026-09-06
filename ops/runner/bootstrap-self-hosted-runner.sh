#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_REG_TOKEN:?RUNNER_REG_TOKEN is required}"
: "${RUNNER_DOWNLOAD_URL:?RUNNER_DOWNLOAD_URL is required}"
: "${RUNNER_SHA256:?RUNNER_SHA256 is required}"
: "${RUNNER_NAME:=jadel-agent-runtime}"
: "${RUNNER_LABELS:=jadel-agent-runtime}"
: "${RUNNER_USER:=github-runner}"
: "${RUNNER_HOME:=/opt/actions-runner}"
: "${REPO_URL:?REPO_URL is required}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "BOOTSTRAP_ROOT=FAIL"
  exit 10
fi

case "$RUNNER_NAME" in
  *[!A-Za-z0-9._-]*|'') echo "RUNNER_NAME_FORMAT=FAIL"; exit 11 ;;
esac
case "$RUNNER_LABELS" in
  *[!A-Za-z0-9,._-]*|'') echo "RUNNER_LABELS_FORMAT=FAIL"; exit 12 ;;
esac

for cmd in curl tar sha256sum systemctl; do
  command -v "$cmd" >/dev/null || { echo "MISSING_COMMAND=$cmd"; exit 13; }
done

if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$RUNNER_USER"
fi

install -d -m 0755 -o "$RUNNER_USER" -g "$RUNNER_USER" "$RUNNER_HOME"
archive="$(mktemp)"
trap 'rm -f "$archive"' EXIT

curl --fail --silent --show-error --location \
  --proto '=https' --tlsv1.2 \
  "$RUNNER_DOWNLOAD_URL" -o "$archive"
printf '%s  %s\n' "$RUNNER_SHA256" "$archive" | sha256sum --check --status || {
  echo "RUNNER_ARCHIVE_SHA256=FAIL"
  exit 14
}
echo "RUNNER_ARCHIVE_SHA256=PASS"

if [[ -f "$RUNNER_HOME/.runner" ]]; then
  if [[ -x "$RUNNER_HOME/svc.sh" ]]; then
    (cd "$RUNNER_HOME" && ./svc.sh stop) || true
    (cd "$RUNNER_HOME" && ./svc.sh uninstall) || true
  fi
  rm -rf "$RUNNER_HOME"/* "$RUNNER_HOME"/.[!.]* "$RUNNER_HOME"/..?* 2>/dev/null || true
fi

tar -xzf "$archive" -C "$RUNNER_HOME"
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"

sudo -u "$RUNNER_USER" -H bash -lc \
  "cd '$RUNNER_HOME' && ./config.sh --unattended --replace --url '$REPO_URL' --token '$RUNNER_REG_TOKEN' --name '$RUNNER_NAME' --labels '$RUNNER_LABELS' --work '_work'"

(
  cd "$RUNNER_HOME"
  ./svc.sh install "$RUNNER_USER"
  ./svc.sh start
  ./svc.sh status
)

echo "RUNNER_SERVICE=ACTIVE"
echo "RUNNER_BOOTSTRAP=PASS"
