#!/usr/bin/env bash
set -euo pipefail

cf_token=$(printf '%s' "$CLOUDFLARE_API_TOKEN_RAW" | tr -d '\r\n' | sed -E 's/^[[:space:]]*Bearer[[:space:]]+//I; s/^[[:space:]]+//; s/[[:space:]]+$//')
account_id=$(printf '%s' "$CLOUDFLARE_ACCOUNT_ID_RAW" | tr -d '\r\n[:space:]')
client_id=$(printf '%s' "$PAYPAL_SANDBOX_CLIENT_ID_RAW" | tr -d '\r\n[:space:]')
client_secret=$(printf '%s' "$PAYPAL_SANDBOX_CLIENT_SECRET_RAW" | tr -d '\r\n')
admin_token=$(printf '%s' "$PAYPAL_SANDBOX_ADMIN_TOKEN_RAW" | tr -d '\r\n')
admin_len=$(printf '%s' "$admin_token" | wc -c | tr -d '[:space:]')

test -n "$cf_token" || { echo 'CLOUDFLARE_WORKER_TOKEN_PRESENT=NO' >&2; exit 2; }
test -n "$account_id" || { echo 'CLOUDFLARE_ACCOUNT_ID_PRESENT=NO' >&2; exit 2; }
test -n "$client_id" || { echo 'PAYPAL_SANDBOX_CLIENT_ID_PRESENT=NO' >&2; exit 3; }
test -n "$client_secret" || { echo 'PAYPAL_SANDBOX_CLIENT_SECRET_PRESENT=NO' >&2; exit 3; }
test "$admin_len" -ge 32 || { echo 'PAYPAL_SANDBOX_ADMIN_TOKEN_STRENGTH=FAIL' >&2; exit 3; }

for value in "$cf_token" "$account_id" "$client_id" "$client_secret" "$admin_token"; do
  echo "::add-mask::$value"
done

export CLOUDFLARE_API_TOKEN="$cf_token"
export CLOUDFLARE_ACCOUNT_ID="$account_id"
export PAYPAL_SANDBOX_CLIENT_ID="$client_id"
export PAYPAL_SANDBOX_CLIENT_SECRET="$client_secret"
export PAYPAL_SANDBOX_ADMIN_TOKEN="$admin_token"

jq -n --arg db "$DATABASE_ID" --arg d1 "$SANDBOX_D1_NAME" --arg worker "$SANDBOX_WORKER_NAME" '{
  "$schema":"./node_modules/wrangler/config-schema.json",
  name:$worker,
  main:"src/project-entry.mjs",
  compatibility_date:"2026-08-31",
  workers_dev:true,
  observability:{enabled:true,head_sampling_rate:1},
  vars:{PAYPAL_ENVIRONMENT:"sandbox"},
  d1_databases:[{
    binding:"DB",
    database_name:$d1,
    database_id:$db
  }]
}' > commercial-runtime/wrangler.paypal-sandbox.jsonc

pushd commercial-runtime >/dev/null
npm install --no-save --ignore-scripts "wrangler@$WRANGLER_VERSION"
actual=$(npx wrangler --version | tr -d '\r\n[:space:]')
test "$actual" = "$WRANGLER_VERSION"
npx wrangler deploy --config wrangler.paypal-sandbox.jsonc 2>&1 | tee /tmp/paypal-sandbox-deploy.log
worker_url=$(grep -Eo 'https://[^[:space:]]+\.workers\.dev' /tmp/paypal-sandbox-deploy.log | tail -n1)
test -n "$worker_url" || { echo 'PAYPAL_SANDBOX_WORKER_URL=NOT_FOUND' >&2; exit 20; }
printf '%s' "$PAYPAL_SANDBOX_ADMIN_TOKEN" | npx wrangler secret put ADMIN_API_TOKEN --config wrangler.paypal-sandbox.jsonc
printf '%s' "$PAYPAL_SANDBOX_CLIENT_ID" | npx wrangler secret put PAYPAL_CLIENT_ID --config wrangler.paypal-sandbox.jsonc
printf '%s' "$PAYPAL_SANDBOX_CLIENT_SECRET" | npx wrangler secret put PAYPAL_CLIENT_SECRET --config wrangler.paypal-sandbox.jsonc
popd >/dev/null
echo 'PAYPAL_SANDBOX_WORKER_DEPLOY=PASS'

paypal_token=$(curl --fail-with-body -sS -u "$PAYPAL_SANDBOX_CLIENT_ID:$PAYPAL_SANDBOX_CLIENT_SECRET" \
  -H 'Accept: application/json' -H 'Accept-Language: en_US' \
  -d 'grant_type=client_credentials' "$PAYPAL_SANDBOX_API/v1/oauth2/token" | jq -r '.access_token')
test -n "$paypal_token" && test "$paypal_token" != null
echo "::add-mask::$paypal_token"

webhook_url="$worker_url/api/v1/paypal/webhooks"
current=$(curl --fail-with-body -sS -H "Authorization: Bearer $paypal_token" \
  "$PAYPAL_SANDBOX_API/v1/notifications/webhooks?page_size=20")
count=$(jq --arg url "$webhook_url" '[.webhooks[]? | select(.url==$url)] | length' <<<"$current")
test "$count" -le 1

if [ "$count" = 1 ]; then
  webhook_id=$(jq -r --arg url "$webhook_url" '.webhooks[] | select(.url==$url) | .id' <<<"$current")
  missing=$(jq -r --arg url "$webhook_url" '
    [.webhooks[] | select(.url==$url) | .event_types[].name] as $events |
    ["PAYMENT.CAPTURE.COMPLETED","PAYMENT.CAPTURE.PENDING","PAYMENT.CAPTURE.DENIED","PAYMENT.CAPTURE.REFUNDED","PAYMENT.CAPTURE.REVERSED"] |
    map(select(. as $required | ($events | index($required)) == null)) | length
  ' <<<"$current")
  test "$missing" = 0 || { echo 'PAYPAL_SANDBOX_WEBHOOK_EVENT_SET_MISMATCH=YES' >&2; exit 21; }
  webhook_action=reused
else
  payload=$(jq -n --arg url "$webhook_url" '{
    url:$url,
    event_types:[
      {name:"PAYMENT.CAPTURE.COMPLETED"},
      {name:"PAYMENT.CAPTURE.PENDING"},
      {name:"PAYMENT.CAPTURE.DENIED"},
      {name:"PAYMENT.CAPTURE.REFUNDED"},
      {name:"PAYMENT.CAPTURE.REVERSED"}
    ]
  }')
  created=$(curl --fail-with-body -sS -X POST \
    -H "Authorization: Bearer $paypal_token" \
    -H 'Content-Type: application/json' \
    --data "$payload" "$PAYPAL_SANDBOX_API/v1/notifications/webhooks")
  webhook_id=$(jq -r '.id' <<<"$created")
  webhook_action=created
fi

test -n "$webhook_id" && test "$webhook_id" != null
pushd commercial-runtime >/dev/null
printf '%s' "$webhook_id" | npx wrangler secret put PAYPAL_WEBHOOK_ID --config wrangler.paypal-sandbox.jsonc
popd >/dev/null
echo "PAYPAL_SANDBOX_WEBHOOK=PASS action=$webhook_action"

health=$(curl --fail-with-body -sS "$worker_url/health")
test "$(jq -r '.status' <<<"$health")" = ok
invalid_code=$(curl -sS -o /tmp/invalid-paypal-webhook.json -w '%{http_code}' \
  -X POST -H 'content-type: application/json' --data '{}' \
  "$worker_url/api/v1/paypal/webhooks")
test "$invalid_code" = 403 || {
  echo "PAYPAL_SANDBOX_LISTENER_FAIL_HTTP_$invalid_code" >&2
  cat /tmp/invalid-paypal-webhook.json >&2
  exit 22
}
echo 'PAYPAL_SANDBOX_LISTENER=PASS'

api() {
  curl --fail-with-body -sS \
    -H "Authorization: Bearer $PAYPAL_SANDBOX_ADMIN_TOKEN" \
    -H 'Content-Type: application/json' "$@"
}

if [ "$PHASE" = prepare ]; then
  test -n "$PROJECT_ID" || { echo 'PAYPAL_SANDBOX_PROJECT_ID_REQUIRED=YES' >&2; exit 30; }

  quote_payload=$(jq -n --arg project "$PROJECT_ID" '{
    project_id:$project,
    currency_code:"USD",
    items:[{
      service_id:"architecture",
      description:"PayPal sandbox E2E certification",
      quantity:1,
      unit_amount_minor:100
    }]
  }')
  quote=$(api -X POST --data "$quote_payload" "$worker_url/api/v1/admin/quotes")
  quote_id=$(jq -r '.quote_id' <<<"$quote")
  test -n "$quote_id" && test "$quote_id" != null

  accept_payload=$(jq -n --arg quote "$quote_id" '{
    quote_id:$quote,
    acceptance_evidence:"PayPal sandbox E2E controlled certification"
  }')
  accepted=$(api -X POST --data "$accept_payload" "$worker_url/api/v1/admin/quotes/accept")
  test "$(jq -r '.quote_status' <<<"$accepted")" = ACCEPTED

  order=$(api -X POST --data "$(jq -n --arg quote "$quote_id" '{quote_id:$quote}')" \
    "$worker_url/api/v1/admin/payment-orders")
  payment_order_id=$(jq -r '.payment_order_id' <<<"$order")
  test "$(jq -r '.amount_minor' <<<"$order")" = 100

  provider_payload=$(jq -n --arg po "$payment_order_id" --arg quote "$quote_id" '{
    intent:"CAPTURE",
    purchase_units:[{
      reference_id:$po,
      custom_id:$po,
      invoice_id:$quote,
      description:"Jadel Tech RD sandbox certification",
      amount:{currency_code:"USD",value:"1.00"}
    }]
  }')
  provider=$(curl --fail-with-body -sS -X POST \
    -H "Authorization: Bearer $paypal_token" \
    -H 'Content-Type: application/json' \
    -H "PayPal-Request-Id: jadel-$payment_order_id" \
    --data "$provider_payload" \
    "$PAYPAL_SANDBOX_API/v2/checkout/orders")
  paypal_order_id=$(jq -r '.id' <<<"$provider")
  approval_url=$(jq -r '.links[]? | select(.rel=="payer-action" or .rel=="approve") | .href' <<<"$provider" | head -n1)
  test -n "$paypal_order_id" && test "$paypal_order_id" != null
  test -n "$approval_url"

  echo "paypal_order_id=$paypal_order_id" >> "$GITHUB_OUTPUT"
  echo "project_id=$PROJECT_ID" >> "$GITHUB_OUTPUT"
  echo "payment_order_id=$payment_order_id" >> "$GITHUB_OUTPUT"

  {
    echo "## PayPal sandbox order prepared"
    echo
    echo "**Sandbox order:** \`$paypal_order_id\`"
    echo
    echo "**Approval URL (use a PayPal sandbox Personal buyer):**"
    echo
    echo "$approval_url"
    echo
    echo "This uses virtual sandbox funds only."
    echo
    echo "After approval, dispatch the workflow again with phase=capture_certify and paypal_order_id=$paypal_order_id."
  } >> "$GITHUB_STEP_SUMMARY"

  echo 'PAYPAL_SANDBOX_PREPARE=PASS'
  exit 0
fi

test "$PHASE" = capture_certify
paypal_order_id=$(printf '%s' "$INPUT_PAYPAL_ORDER_ID" | tr -d '\r\n[:space:]')
test -n "$paypal_order_id" || { echo 'PAYPAL_SANDBOX_ORDER_ID_REQUIRED=YES' >&2; exit 31; }

before=$(curl --fail-with-body -sS -H "Authorization: Bearer $paypal_token" \
  "$PAYPAL_SANDBOX_API/v2/checkout/orders/$paypal_order_id")
status=$(jq -r '.status' <<<"$before")
test "$status" = APPROVED || { echo "PAYPAL_SANDBOX_ORDER_NOT_APPROVED status=$status" >&2; exit 32; }
payment_order_id=$(jq -r '.purchase_units[0].custom_id // empty' <<<"$before")
test -n "$payment_order_id" || { echo 'PAYPAL_SANDBOX_CUSTOM_ID_MISSING=YES' >&2; exit 33; }

captured=$(curl --fail-with-body -sS -X POST \
  -H "Authorization: Bearer $paypal_token" \
  -H 'Content-Type: application/json' \
  -H "PayPal-Request-Id: jadel-capture-$paypal_order_id" \
  --data '{}' \
  "$PAYPAL_SANDBOX_API/v2/checkout/orders/$paypal_order_id/capture")
capture_status=$(jq -r '.purchase_units[0].payments.captures[0].status // .status' <<<"$captured")
test "$capture_status" = COMPLETED || {
  echo "PAYPAL_SANDBOX_CAPTURE_NOT_COMPLETED status=$capture_status" >&2
  exit 34
}
capture_id=$(jq -r '.purchase_units[0].payments.captures[0].id' <<<"$captured")
test -n "$capture_id" && test "$capture_id" != null

ledger_id=""
project_id=""
for attempt in $(seq 1 30); do
  pending=$(api "$worker_url/api/v1/admin/approvals")
  ledger_id=$(jq -r --arg capture "$capture_id" \
    '.payments[]? | select(.resource_id==$capture and .event_type=="PAYMENT.CAPTURE.COMPLETED") | .ledger_id' <<<"$pending" | head -n1)
  project_id=$(jq -r --arg po "$payment_order_id" \
    '.payment_orders[]? | select(.payment_order_id==$po) | .project_id' <<<"$pending" | head -n1)
  if [ -n "$ledger_id" ] && [ -n "$project_id" ]; then
    break
  fi
  sleep 4
done

test -n "$ledger_id" || { echo 'PAYPAL_SANDBOX_REAL_WEBHOOK_NOT_OBSERVED=YES' >&2; exit 35; }
test -n "$project_id" || { echo 'PAYPAL_SANDBOX_INTERNAL_ORDER_NOT_FOUND=YES' >&2; exit 36; }

settle_payload=$(jq -n \
  --arg project "$project_id" \
  --arg ledger "$ledger_id" \
  --arg order "$payment_order_id" \
  '{project_id:$project,ledger_id:$ledger,payment_order_id:$order,decision:"MATCHED",reason:"real PayPal sandbox completed webhook certified"}')
settlement=$(api -X POST --data "$settle_payload" "$worker_url/api/v1/admin/payments/reconcile")
test "$(jq -r '.project_state' <<<"$settlement")" = PAID
test "$(jq -r '.ledger_state' <<<"$settlement")" = MATCHED
settlement_id=$(jq -r '.settlement_id' <<<"$settlement")
test -n "$settlement_id" && test "$settlement_id" != null

echo "paypal_order_id=$paypal_order_id" >> "$GITHUB_OUTPUT"
echo "project_id=$project_id" >> "$GITHUB_OUTPUT"
echo "payment_order_id=$payment_order_id" >> "$GITHUB_OUTPUT"
echo "ledger_id=$ledger_id" >> "$GITHUB_OUTPUT"
echo "settlement_id=$settlement_id" >> "$GITHUB_OUTPUT"
echo "capture_id=$capture_id" >> "$GITHUB_OUTPUT"
echo 'PAYPAL_SANDBOX_CAPTURE_WEBHOOK_SETTLEMENT=PASS'
