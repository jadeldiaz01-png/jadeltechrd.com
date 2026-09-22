#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?GH_TOKEN is required}"
REPO="${SLO_REPOSITORY:-jadeldiaz01-png/jadeltechrd.com}"
WORKFLOW="site-slo-evidence.yml"
REF="${SLO_REF:-main}"
MODE="${1:-dispatch}"

api() {
  curl --fail --silent --show-error -H "Accept: application/vnd.github+json"     -H "Authorization: Bearer ${GH_TOKEN}" -H "X-GitHub-Api-Version: 2022-11-28" "$@"
}

if [[ "$MODE" == "dispatch" ]]; then
  api -X POST "https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches"     -d "{\"ref\":\"${REF}\",\"inputs\":{\"evidence_provider\":\"external_watchdog\"}}"
  echo "SLO_EXTERNAL_DISPATCH=ACCEPTED"
  exit 0
fi

if [[ "$MODE" == "watchdog" ]]; then
  now=$(date -u +%s)
  latest=$(api "https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=20" |
    jq -r '[.workflow_runs[] | select(.display_title | contains("[external_watchdog]"))] | sort_by(.created_at) | last | .created_at // empty')
  [[ -n "$latest" ]] || { echo "SLO_EXTERNAL_WATCHDOG=FAIL reason=no_external_run" >&2; exit 2; }
  last=$(date -u -d "$latest" +%s)
  age=$(( (now-last)/60 ))
  if (( age > 30 )); then
    echo "SLO_EXTERNAL_WATCHDOG=FAIL age_minutes=$age" >&2
    exit 3
  fi
  echo "SLO_EXTERNAL_WATCHDOG=PASS age_minutes=$age"
  exit 0
fi

echo "usage: $0 dispatch|watchdog" >&2
exit 64
