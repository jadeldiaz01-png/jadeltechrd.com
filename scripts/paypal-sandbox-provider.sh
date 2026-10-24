#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/paypal-sandbox-provider-status.sh"

cf_token=$(printf '%s' "$CLOUDFLARE_API_TOKEN_RAW" | tr -d '\r\n' | sed -E 's/^[[:space:]]*Bearer[[:space:]]+//I; s/^[[:space:]]+//; s/[[:space:]]+$//')
account_id=$(printf '%s' "$CLOUDFLARE_ACCOUNT_ID_RAW" | tr -d '\r\n[:space:]')
client_id=$(printf '%s' "$PAYPAL_SANDBOX_CLIENT_ID_RAW" | tr -d '\r\n[:space:]')
client_secret=$(printf '%s' "$PAYPAL_SANDBOX_CLIENT_SECRET_RAW" | tr -d '\r\n')
admin_token=$(printf '%s' "$PAYPAL_SANDBOX_ADMIN_TOKEN_RAW" | tr -d '\r\n')
admin_len=$(printf '%s' "$admin_token" | wc -c | tr -d '[:space:]')
automatic_mode=false
if [ "$PHASE" = prepare_auto ] || [ "$PHASE" = auto_capture_certify ]; then
  automatic_mode=true
fi

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

jq -n --arg db "$DATABASE_ID" --arg d1 "$SANDBOX_D1_NAME" --arg worker "$SANDBOX_WORKER_NAME" --argjson automatic "$automatic_mode" '{
  "$schema":"./node_modules/wrangler/config-schema.json",
  name:$worker,
  main:"src/project-entry.mjs",
  compatibility_date:"2026-08-31",
  workers_dev:true,
  observability:{enabled:true,head_sampling_rate:1},
  vars:(
    {PAYPAL_ENVIRONMENT:"sandbox",PAYPAL_ORDER_CREATION_ENABLED:"true"} +
    (if $automatic then {
      PAYPAL_AUTOMATIC_CAPTURE_ENABLED:"true",
      PAYPAL_AUTOMATIC_RECONCILIATION_ENABLED:"true",
      PAYPAL_AUTOMATIC_CAPTURE_MAX_MINOR:"25000",
      FINANCIAL_EXECUTION_AUTHORIZED:"true"
    } else {} end)
  ),
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
  missing=$(jq -r --arg url "$webhook_url" --argjson automatic "$automatic_mode" '
    [.webhooks[] | select(.url==$url) | .event_types[].name] as $events |
    (["PAYMENT.CAPTURE.COMPLETED","PAYMENT.CAPTURE.PENDING","PAYMENT.CAPTURE.DENIED","PAYMENT.CAPTURE.REFUNDED","PAYMENT.CAPTURE.REVERSED"] + (if $automatic then ["CHECKOUT.ORDER.APPROVED"] else [] end)) |
    map(select(. as $required | ($events | index($required)) == null)) | length
  ' <<<"$current")
  if [ "$missing" != 0 ] && [ "$automatic_mode" = true ]; then
    event_types=$(jq -n '{event_types:[
      {name:"CHECKOUT.ORDER.APPROVED"},
      {name:"PAYMENT.CAPTURE.COMPLETED"},
      {name:"PAYMENT.CAPTURE.PENDING"},
      {name:"PAYMENT.CAPTURE.DENIED"},
      {name:"PAYMENT.CAPTURE.REFUNDED"},
      {name:"PAYMENT.CAPTURE.REVERSED"}
    ]}')
    curl --fail-with-body -sS -X PATCH \
      -H "Authorization: Bearer $paypal_token" \
      -H 'Content-Type: application/json' \
      --data "$(jq -n --argjson events "$(jq -c '.event_types' <<<"$event_types")" '[{op:"replace",path:"/event_types",value:$events}]')" \
      "$PAYPAL_SANDBOX_API/v1/notifications/webhooks/$webhook_id" >/dev/null
    webhook_action=updated
  elif [ "$missing" != 0 ]; then
    echo 'PAYPAL_SANDBOX_WEBHOOK_EVENT_SET_MISMATCH=YES' >&2
    exit 21
  else
    webhook_action=reused
  fi
else
  payload=$(jq -n --arg url "$webhook_url" --argjson automatic "$automatic_mode" '{
    url:$url,
    event_types:([
      {name:"PAYMENT.CAPTURE.COMPLETED"},
      {name:"PAYMENT.CAPTURE.PENDING"},
      {name:"PAYMENT.CAPTURE.DENIED"},
      {name:"PAYMENT.CAPTURE.REFUNDED"},
      {name:"PAYMENT.CAPTURE.REVERSED"}
    ] + (if $automatic then [{name:"CHECKOUT.ORDER.APPROVED"}] else [] end))
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

listener_ready=false
for attempt in $(seq 1 12); do
  invalid_code=$(curl -sS -o /tmp/invalid-paypal-webhook.json -w '%{http_code}' \
    -X POST -H 'content-type: application/json' --data '{}' \
    "$worker_url/api/v1/paypal/webhooks")
  invalid_error=$(jq -r '.error // empty' /tmp/invalid-paypal-webhook.json 2>/dev/null || true)

  if [ "$invalid_code" = 403 ] && [ "$invalid_error" = PAYPAL_WEBHOOK_REJECTED ]; then
    listener_ready=true
    echo "PAYPAL_SANDBOX_LISTENER=PASS attempt=$attempt"
    break
  fi

  if [ "$invalid_code" = 503 ] && [ "$invalid_error" = PAYPAL_WEBHOOK_NOT_CONFIGURED ]; then
    if [ "$attempt" -lt 12 ]; then
      echo "PAYPAL_SANDBOX_LISTENER_PROPAGATION_WAIT attempt=$attempt"
      sleep 5
      continue
    fi

    echo 'PAYPAL_SANDBOX_LISTENER_FAIL_PERSISTENT_NOT_CONFIGURED' >&2
    cat /tmp/invalid-paypal-webhook.json >&2
    exit 22
  fi

  echo "PAYPAL_SANDBOX_LISTENER_FAIL_HTTP_$invalid_code error=${invalid_error:-UNKNOWN}" >&2
  cat /tmp/invalid-paypal-webhook.json >&2
  exit 22
done

test "$listener_ready" = true || {
  echo 'PAYPAL_SANDBOX_LISTENER_FAIL_NOT_READY' >&2
  exit 22
}

api() {
  curl --fail-with-body -sS \
    -H "Authorization: Bearer $PAYPAL_SANDBOX_ADMIN_TOKEN" \
    -H 'Content-Type: application/json' "$@"
}

payment_snapshot() {
  api --get \
    --data-urlencode "capture_id=$capture_id" \
    --data-urlencode "payment_order_id=$payment_order_id" \
    "$worker_url/api/v1/admin/approvals"
}

if [ "$PHASE" = prepare ] || [ "$PHASE" = prepare_auto ]; then
  test -n "$PROJECT_ID" || { echo 'PAYPAL_SANDBOX_PROJECT_ID_REQUIRED=YES' >&2; exit 30; }

  quote=$(api -X POST --data "$(jq -n --arg project "$PROJECT_ID" '{project_id:$project}')"     "$worker_url/api/v1/admin/quotes/from-catalog")
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
  test "$(jq -r '.amount_minor' <<<"$order")" = 25000

  paypal_order_id=$(jq -r '.provider_order_id' <<<"$order")
  approval_url=$(jq -r '.approval_url' <<<"$order")
  test "$(jq -r '.provider_environment' <<<"$order")" = sandbox
  test "$(jq -r '.provider_call_performed' <<<"$order")" = true
  test "$(jq -r '.capture_performed' <<<"$order")" = false
  test "$(jq -r '.financial_execution_authorized' <<<"$order")" = false
  test -n "$paypal_order_id" && test "$paypal_order_id" != null
  test -n "$approval_url" && test "$approval_url" != null

  provider_snapshot=$(curl --fail-with-body -sS \
    -H "Authorization: Bearer $paypal_token" \
    "$PAYPAL_SANDBOX_API/v2/checkout/orders/$paypal_order_id")
  provider_status=$(jq -r '.status // empty' <<<"$provider_snapshot")
  paypal_require_prepare_provider_status "$provider_status"
  test "$(jq -r '.purchase_units[0].custom_id' <<<"$provider_snapshot")" = "$payment_order_id"
  test "$(jq -r '.purchase_units[0].invoice_id' <<<"$provider_snapshot")" = "$quote_id"
  test "$(jq -r '.purchase_units[0].amount.value' <<<"$provider_snapshot")" = 250.00
  echo "PAYPAL_SANDBOX_LINKAGE=PASS quote_id=$quote_id payment_order_id=$payment_order_id provider_order_id=$paypal_order_id"
  echo "PAYPAL_SANDBOX_PREPARE_ASSERTIONS=PASS amount_minor=25000 provider_environment=sandbox capture_performed=false financial_execution_authorized=false provider_status=$provider_status"

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
    if [ "$automatic_mode" = true ]; then
      echo "After buyer approval, dispatch the workflow again with phase=auto_capture_certify and paypal_order_id=$paypal_order_id."
    else
      echo "After approval, dispatch the workflow again with phase=capture_certify and paypal_order_id=$paypal_order_id."
    fi
  } >> "$GITHUB_STEP_SUMMARY"

  echo 'PAYPAL_SANDBOX_DYNAMIC_ORDER_PREPARE=PASS'
  exit 0
fi

paypal_order_id=$(printf '%s' "$INPUT_PAYPAL_ORDER_ID" | tr -d '\r\n[:space:]')
test -n "$paypal_order_id" || { echo 'PAYPAL_SANDBOX_ORDER_ID_REQUIRED=YES' >&2; exit 31; }

if [ "$PHASE" = recover_certify ]; then
  recovered=$(curl --fail-with-body -sS -H "Authorization: Bearer $paypal_token" \
    "$PAYPAL_SANDBOX_API/v2/checkout/orders/$paypal_order_id")
  status=$(jq -r '.status' <<<"$recovered")
  test "$status" = COMPLETED || { echo "PAYPAL_SANDBOX_RECOVERY_ORDER_NOT_COMPLETED status=$status" >&2; exit 37; }

  payment_order_id=$(jq -r '.purchase_units[0].custom_id // empty' <<<"$recovered")
  capture_id=$(jq -r '.purchase_units[0].payments.captures[0].id // empty' <<<"$recovered")
  capture_status=$(jq -r '.purchase_units[0].payments.captures[0].status // empty' <<<"$recovered")
  test -n "$payment_order_id" || { echo 'PAYPAL_SANDBOX_RECOVERY_CUSTOM_ID_MISSING=YES' >&2; exit 38; }
  test -n "$capture_id" || { echo 'PAYPAL_SANDBOX_RECOVERY_CAPTURE_ID_MISSING=YES' >&2; exit 39; }
  test "$capture_status" = COMPLETED || {
    echo "PAYPAL_SANDBOX_RECOVERY_CAPTURE_NOT_COMPLETED status=$capture_status" >&2
    exit 40
  }

  pending=$(payment_snapshot)
  existing_ledger_id=$(jq -r --arg capture "$capture_id" \
    '.payments[]? | select(.resource_id==$capture and .event_type=="PAYMENT.CAPTURE.COMPLETED") | .ledger_id' <<<"$pending" | head -n1)

  if [ -z "$existing_ledger_id" ]; then
    events=$(curl --fail-with-body -sS --get \
      -H "Authorization: Bearer $paypal_token" \
      --data-urlencode "transaction_id=$capture_id" \
      --data-urlencode "event_type=PAYMENT.CAPTURE.COMPLETED" \
      --data-urlencode "page_size=20" \
      "$PAYPAL_SANDBOX_API/v1/notifications/webhooks-events")
    event_count=$(jq -r --arg capture "$capture_id" --arg order "$paypal_order_id" \
      '[.events[]? | select(.event_type=="PAYMENT.CAPTURE.COMPLETED" and .resource.id==$capture and .resource.supplementary_data.related_ids.order_id==$order)] | length' <<<"$events")
    test "$event_count" = 1 || {
      echo "PAYPAL_SANDBOX_RECOVERY_EVENT_COUNT=$event_count" >&2
      exit 41
    }
    event_id=$(jq -r --arg capture "$capture_id" --arg order "$paypal_order_id" \
      '.events[] | select(.event_type=="PAYMENT.CAPTURE.COMPLETED" and .resource.id==$capture and .resource.supplementary_data.related_ids.order_id==$order) | .id' <<<"$events")
    test -n "$event_id" && test "$event_id" != null

    resend_payload=$(jq -n --arg webhook "$webhook_id" '{webhook_ids:[$webhook]}')
    curl --fail-with-body -sS -X POST \
      -H "Authorization: Bearer $paypal_token" \
      -H 'Content-Type: application/json' \
      --data "$resend_payload" \
      "$PAYPAL_SANDBOX_API/v1/notifications/webhooks-events/$event_id/resend" >/dev/null
    echo 'PAYPAL_SANDBOX_WEBHOOK_RECOVERY_RESEND=PASS'
  else
    echo 'PAYPAL_SANDBOX_WEBHOOK_RECOVERY_RESEND=SKIPPED_ALREADY_OBSERVED'
  fi
elif [ "$PHASE" = capture_certify ] || [ "$PHASE" = auto_capture_certify ]; then
  if [ "$PHASE" = auto_capture_certify ]; then
    test "$automatic_mode" = true
    status=""
    for attempt in $(seq 1 30); do
      before=$(curl --fail-with-body -sS -H "Authorization: Bearer $paypal_token" \
        "$PAYPAL_SANDBOX_API/v2/checkout/orders/$paypal_order_id")
      status=$(jq -r '.status' <<<"$before")
      [ "$status" = COMPLETED ] && break
      [ "$status" = APPROVED ] || { echo "PAYPAL_SANDBOX_ORDER_NOT_APPROVED status=$status" >&2; exit 32; }
      sleep 4
    done
    test "$status" = COMPLETED || { echo "PAYPAL_SANDBOX_AUTO_CAPTURE_TIMEOUT status=$status" >&2; exit 34; }
    payment_order_id=$(jq -r '.purchase_units[0].custom_id // empty' <<<"$before")
    capture_id=$(jq -r '.purchase_units[0].payments.captures[0].id // empty' <<<"$before")
    test -n "$payment_order_id" && test -n "$capture_id"
    test "$(jq -r '.purchase_units | length' <<<"$before")" = 1
    test "$(jq -r '.purchase_units[0].amount.value' <<<"$before")" = 250.00
    test "$(jq -r '.purchase_units[0].amount.currency_code' <<<"$before")" = USD
    test "$(jq -r '.purchase_units[0].payments.captures | length' <<<"$before")" = 1
    test "$(jq -r '.purchase_units[0].payments.captures[0].status' <<<"$before")" = COMPLETED
    test "$(jq -r '.purchase_units[0].payments.captures[0].amount.value' <<<"$before")" = 250.00
    echo 'PAYPAL_SANDBOX_AUTOMATIC_CAPTURE=PASS mode=buyer_approval_webhook captures=1 amount_minor=25000'
  else
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
  fi
else
  echo "PAYPAL_SANDBOX_PHASE_INVALID=$PHASE" >&2
  exit 30
fi

ledger_id=""
project_id=""
for attempt in $(seq 1 30); do
  pending=$(payment_snapshot)
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

if [ "$PHASE" = auto_capture_certify ]; then
  test "$(jq -r --arg capture "$capture_id" '[.payments[]? | select(.resource_id==$capture and .event_type=="PAYMENT.CAPTURE.COMPLETED" and .ledger_state=="MATCHED")] | length' <<<"$pending")" = 1
  test "$(jq -r --arg po "$payment_order_id" '[.payment_orders[]? | select(.payment_order_id==$po and .status=="COMPLETED")] | length' <<<"$pending")" = 1
  test "$(jq -r --arg capture "$capture_id" '[.payments[]? | select(.resource_id==$capture and .event_type=="PAYMENT.CAPTURE.COMPLETED") | .ledger_id] | unique | length' <<<"$pending")" = 1

  events=$(curl --fail-with-body -sS --get \
    -H "Authorization: Bearer $paypal_token" \
    --data-urlencode "transaction_id=$capture_id" \
    --data-urlencode "event_type=PAYMENT.CAPTURE.COMPLETED" \
    --data-urlencode "page_size=20" \
    "$PAYPAL_SANDBOX_API/v1/notifications/webhooks-events")
  event_count=$(jq -r --arg capture "$capture_id" --arg order "$paypal_order_id" \
    '[.events[]? | select(.event_type=="PAYMENT.CAPTURE.COMPLETED" and .resource.id==$capture and .resource.supplementary_data.related_ids.order_id==$order)] | length' <<<"$events")
  test "$event_count" = 1 || { echo "PAYPAL_SANDBOX_CAPTURE_EVENT_COUNT=$event_count" >&2; exit 41; }
  event_id=$(jq -r --arg capture "$capture_id" --arg order "$paypal_order_id" \
    '.events[] | select(.event_type=="PAYMENT.CAPTURE.COMPLETED" and .resource.id==$capture and .resource.supplementary_data.related_ids.order_id==$order) | .id' <<<"$events")
  tail_log=$(mktemp)
  tail_pid=""
  cleanup_tail() {
    if [ -n "$tail_pid" ]; then kill "$tail_pid" 2>/dev/null || true; wait "$tail_pid" 2>/dev/null || true; fi
    rm -f "$tail_log"
  }
  trap cleanup_tail EXIT
  pushd commercial-runtime >/dev/null
  npx wrangler tail "$SANDBOX_WORKER_NAME" --format json > "$tail_log" 2>&1 &
  tail_pid=$!
  popd >/dev/null
  sleep 5
  kill -0 "$tail_pid" 2>/dev/null || { echo 'PAYPAL_SANDBOX_WORKER_TAIL_START=FAIL' >&2; exit 44; }
  resend_payload=$(jq -n --arg webhook "$webhook_id" '{webhook_ids:[$webhook]}')
  curl --fail-with-body -sS -X POST \
    -H "Authorization: Bearer $paypal_token" -H 'Content-Type: application/json' \
    --data "$resend_payload" \
    "$PAYPAL_SANDBOX_API/v1/notifications/webhooks-events/$event_id/resend" >/dev/null
  replay_ok=false
  for attempt in $(seq 1 15); do
    pending=$(payment_snapshot)
    replay_count=$(jq -r --arg capture "$capture_id" '[.payments[]? | select(.resource_id==$capture and .event_type=="PAYMENT.CAPTURE.COMPLETED" and .ledger_state=="MATCHED")] | length' <<<"$pending")
    if [ "$replay_count" = 1 ] && grep -Fq 'paypal_webhook_replay_idempotent' "$tail_log"; then replay_ok=true; break; fi
    sleep 2
  done
  test "$replay_ok" = true || { echo 'PAYPAL_SANDBOX_WEBHOOK_REPLAY_IDEMPOTENCY=FAIL' >&2; exit 42; }
  cleanup_tail
  trap - EXIT
  echo 'PAYPAL_SANDBOX_WEBHOOK_REPLAY_IDEMPOTENCY=PASS matched_ledger_rows=1'
  echo "webhook_replay_status=PASS" >> "$GITHUB_OUTPUT"
fi

if [ "$PHASE" = auto_capture_certify ]; then
  settlement_id=""
  echo 'PAYPAL_SANDBOX_SETTLEMENT_READONLY_CERTIFICATION=DEFERRED'
else
settle_payload=$(jq -n \
  --arg project "$project_id" \
  --arg ledger "$ledger_id" \
  --arg order "$payment_order_id" \
  '{project_id:$project,ledger_id:$ledger,payment_order_id:$order,decision:"MATCHED",reason:"real PayPal sandbox completed webhook certified or recovered"}')
settlement=$(api -X POST --data "$settle_payload" "$worker_url/api/v1/admin/payments/reconcile")
test "$(jq -r '.project_state' <<<"$settlement")" = PAID
test "$(jq -r '.ledger_state' <<<"$settlement")" = MATCHED
settlement_id=$(jq -r '.settlement_id' <<<"$settlement")
test -n "$settlement_id" && test "$settlement_id" != null
fi

echo "paypal_order_id=$paypal_order_id" >> "$GITHUB_OUTPUT"
echo "project_id=$project_id" >> "$GITHUB_OUTPUT"
echo "payment_order_id=$payment_order_id" >> "$GITHUB_OUTPUT"
echo "ledger_id=$ledger_id" >> "$GITHUB_OUTPUT"
echo "settlement_id=$settlement_id" >> "$GITHUB_OUTPUT"
echo "capture_id=$capture_id" >> "$GITHUB_OUTPUT"
if [ "$PHASE" = recover_certify ]; then
  echo 'PAYPAL_SANDBOX_WEBHOOK_RECOVERY_SETTLEMENT=PASS'
elif [ "$PHASE" = auto_capture_certify ]; then
  echo 'PAYPAL_SANDBOX_AUTOMATIC_CAPTURE_RECONCILIATION=PASS'
else
  echo 'PAYPAL_SANDBOX_CAPTURE_WEBHOOK_SETTLEMENT=PASS'
fi
