#!/usr/bin/env bash
set -euo pipefail

token=$(printf '%s' "$CLOUDFLARE_D1_API_TOKEN_RAW" | tr -d '\r\n' | sed -E 's/^[[:space:]]*Bearer[[:space:]]+//I; s/^[[:space:]]+//; s/[[:space:]]+$//')
account_id=$(printf '%s' "$CLOUDFLARE_ACCOUNT_ID_RAW" | tr -d '\r\n[:space:]')
test -n "$token" || { echo 'CLOUDFLARE_D1_TOKEN_PRESENT=NO' >&2; exit 2; }
test -n "$account_id" || { echo 'CLOUDFLARE_ACCOUNT_ID_PRESENT=NO' >&2; exit 2; }
echo "::add-mask::$token"
echo "::add-mask::$account_id"
export CLOUDFLARE_API_TOKEN="$token"
export CLOUDFLARE_ACCOUNT_ID="$account_id"

list=$(curl --fail-with-body -sS --get \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-urlencode "name=$SANDBOX_D1_NAME" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database")
test "$(jq -r '.success' <<<"$list")" = true
count=$(jq --arg n "$SANDBOX_D1_NAME" '[.result[] | select(.name==$n)] | length' <<<"$list")
test "$count" -le 1

if [ "$count" = 1 ]; then
  database_id=$(jq -r --arg n "$SANDBOX_D1_NAME" '.result[] | select(.name==$n) | .uuid' <<<"$list")
  action=existing
else
  request=$(jq -n --arg name "$SANDBOX_D1_NAME" '{name:$name}')
  created=$(curl --fail-with-body -sS -X POST \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H 'Content-Type: application/json' \
    --data "$request" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database")
  test "$(jq -r '.success' <<<"$created")" = true
  database_id=$(jq -r '.result.uuid' <<<"$created")
  action=created
fi

test -n "$database_id" && test "$database_id" != null
echo "database_id=$database_id" >> "$GITHUB_OUTPUT"
echo "PAYPAL_SANDBOX_D1=PASS action=$action"

jq -n --arg db "$database_id" --arg name "$SANDBOX_D1_NAME" '{
  "$schema":"./node_modules/wrangler/config-schema.json",
  name:"jadel-commercial-paypal-sandbox-migrations",
  compatibility_date:"2026-08-31",
  d1_databases:[{
    binding:"DB",
    database_name:$name,
    database_id:$db,
    migrations_dir:"migrations"
  }]
}' > commercial-runtime/wrangler.paypal-sandbox-d1.jsonc

pushd commercial-runtime >/dev/null
npm install --no-save --ignore-scripts "wrangler@$WRANGLER_VERSION"
actual=$(npx wrangler --version | tr -d '\r\n[:space:]')
test "$actual" = "$WRANGLER_VERSION"
npx wrangler d1 migrations apply "$SANDBOX_D1_NAME" --remote --config wrangler.paypal-sandbox-d1.jsonc
popd >/dev/null
echo 'PAYPAL_SANDBOX_D1_MIGRATIONS=PASS'

project_id=""
if [ "$PHASE" = prepare ]; then
  project_id=$(python3 -c 'import uuid; print(uuid.uuid4())')
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  idempotency="paypal-sandbox-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
  fingerprint=$(printf '%s' "$project_id" | sha256sum | awk '{print $1}')
  payload=$(jq -n \
    --arg project "$project_id" \
    --arg idem "$idempotency" \
    --arg fp "$fingerprint" \
    --arg now "$now" \
    '{sql:"INSERT INTO project_requests (project_id,idempotency_key,request_fingerprint,name,email,company,service_ids_json,notes,locale,state,policy_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",params:[$project,$idem,$fp,"PayPal Sandbox E2E","paypal-sandbox@example.invalid","Jadel Tech RD Sandbox","[\"architecture\"]","","es-DO","POLICY_ALLOWED","ALLOWED",$now,$now]}')
  response=$(curl --fail-with-body -sS -X POST \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H 'Content-Type: application/json' \
    --data "$payload" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database/$database_id/query")
  test "$(jq -r '.success' <<<"$response")" = true
  echo 'PAYPAL_SANDBOX_PROJECT_SEED=PASS'
fi

echo "project_id=$project_id" >> "$GITHUB_OUTPUT"
