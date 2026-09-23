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

# Install a root-owned, single-purpose SLO deployment boundary. The runner gets no general sudo.
for cmd in python3 visudo; do command -v "$cmd" >/dev/null || { echo "MISSING_COMMAND=$cmd"; exit 13; }; done
cat > /usr/local/sbin/jadel-slo-deploy-helper <<'SLO_HELPER'
#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" -eq 0 ]]
[[ "$#" -eq 1 ]]
expected_sha="$1"
[[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]]
repo="jadeldiaz01-png/jadeltechrd.com"
api="https://api.github.com/repos/$repo"
main_sha="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$api/commits/main" | python3 -c 'import json,sys; print(json.load(sys.stdin)["sha"])')"
test "$main_sha" = "$expected_sha"
IFS= read -r slo_token
test -n "$slo_token"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
files=(
  ops/site-slo-external-watchdog.sh
  ops/systemd/jadel-site-slo-dispatch.service
  ops/systemd/jadel-site-slo-dispatch.timer
  ops/systemd/jadel-site-slo-watchdog.service
  ops/systemd/jadel-site-slo-watchdog.timer
)
for f in "${files[@]}"; do
  install -d "$tmpdir/$(dirname "$f")"
  curl -fsSL --proto '=https' --tlsv1.2 "https://raw.githubusercontent.com/$repo/$expected_sha/$f" -o "$tmpdir/$f"
done
! grep -R -E 'production_authorized[=:][[:space:]]*true' "$tmpdir/ops/site-slo-external-watchdog.sh" "$tmpdir"/ops/systemd/jadel-site-slo-*
install -d -m 0755 /srv/jadeltechrd/current/ops /etc/jadel
install -m 0755 "$tmpdir/ops/site-slo-external-watchdog.sh" /srv/jadeltechrd/current/ops/site-slo-external-watchdog.sh
for unit in jadel-site-slo-dispatch.service jadel-site-slo-dispatch.timer jadel-site-slo-watchdog.service jadel-site-slo-watchdog.timer; do
  install -m 0644 "$tmpdir/ops/systemd/$unit" "/etc/systemd/system/$unit"
done
umask 077
printf 'GH_TOKEN=%s\nSLO_REPOSITORY=%s\nSLO_REF=main\n' "$slo_token" "$repo" > /etc/jadel/site-slo-watchdog.env
chmod 0600 /etc/jadel/site-slo-watchdog.env
systemctl daemon-reload
systemctl enable --now jadel-site-slo-dispatch.timer jadel-site-slo-watchdog.timer
systemctl is-enabled --quiet jadel-site-slo-dispatch.timer
systemctl is-enabled --quiet jadel-site-slo-watchdog.timer
systemctl is-active --quiet jadel-site-slo-dispatch.timer
systemctl is-active --quiet jadel-site-slo-watchdog.timer
systemctl start jadel-site-slo-dispatch.service
sleep 8
systemctl start jadel-site-slo-watchdog.service
systemctl is-failed --quiet jadel-site-slo-dispatch.service && exit 70 || true
systemctl is-failed --quiet jadel-site-slo-watchdog.service && exit 71 || true
echo SLO_PRIVILEGED_INSTALL=PASS
SLO_HELPER
chmod 0755 /usr/local/sbin/jadel-slo-deploy-helper
chown root:root /usr/local/sbin/jadel-slo-deploy-helper
printf '%s\n' "$RUNNER_USER ALL=(root) NOPASSWD: /usr/local/sbin/jadel-slo-deploy-helper [0-9a-f]*" > /etc/sudoers.d/jadel-slo-deploy
chmod 0440 /etc/sudoers.d/jadel-slo-deploy
visudo -cf /etc/sudoers.d/jadel-slo-deploy >/dev/null

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
