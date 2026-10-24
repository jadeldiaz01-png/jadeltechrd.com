#!/usr/bin/env bash
set -euo pipefail

token=$(printf '%s' "$CLOUDFLARE_D1_READONLY_API_TOKEN_RAW" | tr -d '\r\n' | sed -E 's/^[[:space:]]*Bearer[[:space:]]+//I; s/^[[:space:]]+//; s/[[:space:]]+$//')
account_id=$(printf '%s' "$CLOUDFLARE_ACCOUNT_ID_RAW" | tr -d '\r\n[:space:]')
test -n "$token" || { echo 'CLOUDFLARE_D1_READONLY_TOKEN_PRESENT=NO' >&2; exit 2; }
test -n "$account_id" || { echo 'CLOUDFLARE_ACCOUNT_ID_PRESENT=NO' >&2; exit 2; }
for value in "$token" "$account_id"; do echo "::add-mask::$value"; done

for required in "$DATABASE_ID" "$PROJECT_ID" "$PAYMENT_ORDER_ID" "$LEDGER_ID" "$PAYPAL_ORDER_ID" "$CAPTURE_ID"; do
  test -n "$required" || { echo 'PAYPAL_SANDBOX_CERTIFICATION_INPUT_MISSING=YES' >&2; exit 3; }
done

payload=$(jq -n \
  --arg project "$PROJECT_ID" \
  --arg po "$PAYMENT_ORDER_ID" \
  --arg ledger "$LEDGER_ID" \
  --arg capture "$CAPTURE_ID" \
  '{sql:"SELECT s.settlement_id,p.state AS project_state,po.status AS payment_order_status,l.ledger_state,e.event_type,e.verification_status,s.status AS settlement_status FROM project_requests p JOIN payment_orders po ON po.project_id=p.project_id JOIN payment_ledger l ON l.project_id=p.project_id JOIN payment_events e ON e.provider_event_id=l.provider_event_id JOIN sales_settlements s ON s.payment_order_id=po.payment_order_id AND s.ledger_id=l.ledger_id WHERE p.project_id=? AND po.payment_order_id=? AND l.ledger_id=? AND e.resource_id=? AND e.event_type=?",params:[$project,$po,$ledger,$capture,"PAYMENT.CAPTURE.COMPLETED"]}')

result=$(curl --fail-with-body -sS -X POST \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  --data "$payload" \
  "https://api.cloudflare.com/client/v4/accounts/$account_id/d1/database/$DATABASE_ID/query")
test "$(jq -r '.success' <<<"$result")" = true
row_count=$(jq -r '.result[0].results | length' <<<"$result")
test "$row_count" = 1 || { echo "PAYPAL_SANDBOX_SETTLEMENT_JOIN_COUNT=$row_count" >&2; exit 5; }
row=$(jq -c '.result[0].results[0]' <<<"$result")
test "$row" != null
SETTLEMENT_ID=$(jq -r '.settlement_id' <<<"$row")
test -n "$SETTLEMENT_ID" && test "$SETTLEMENT_ID" != null
test "$(jq -r '.project_state' <<<"$row")" = PAID
test "$(jq -r '.payment_order_status' <<<"$row")" = COMPLETED
test "$(jq -r '.ledger_state' <<<"$row")" = MATCHED
test "$(jq -r '.event_type' <<<"$row")" = PAYMENT.CAPTURE.COMPLETED
test "$(jq -r '.verification_status' <<<"$row")" = VERIFIED
test "$(jq -r '.settlement_status' <<<"$row")" = MATCHED

if [ "$AUTOMATIC_MODE" = true ]; then
  test "$WEBHOOK_REPLAY_STATUS" = PASS || { echo 'PAYPAL_SANDBOX_REPLAY_EVIDENCE_MISSING=YES' >&2; exit 4; }
  test "$MISMATCH_NEGATIVE_TEST_STATUS" = PASS || { echo 'PAYPAL_SANDBOX_MISMATCH_TEST_MISSING=YES' >&2; exit 4; }
  count_payload=$(jq -n --arg capture "$CAPTURE_ID" --arg po "$PAYMENT_ORDER_ID" '{sql:"SELECT (SELECT COUNT(*) FROM payment_events WHERE event_type=? AND resource_id=?) AS event_count,(SELECT COUNT(*) FROM payment_ledger l JOIN payment_events e ON e.provider_event_id=l.provider_event_id WHERE e.event_type=? AND e.resource_id=? AND l.ledger_state=?) AS ledger_count,(SELECT COUNT(*) FROM sales_settlements WHERE payment_order_id=? AND status=?) AS settlement_count",params:["PAYMENT.CAPTURE.COMPLETED",$capture,"PAYMENT.CAPTURE.COMPLETED",$capture,"MATCHED",$po,"MATCHED"]}')
  counts=$(curl --fail-with-body -sS -X POST \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    --data "$count_payload" \
    "https://api.cloudflare.com/client/v4/accounts/$account_id/d1/database/$DATABASE_ID/query")
  test "$(jq -r '.success' <<<"$counts")" = true
  count_row=$(jq -c '.result[0].results[0]' <<<"$counts")
  test "$(jq -r '.event_count' <<<"$count_row")" = 1
  test "$(jq -r '.ledger_count' <<<"$count_row")" = 1
  test "$(jq -r '.settlement_count' <<<"$count_row")" = 1
  echo 'PAYPAL_SANDBOX_EXACTLY_ONCE_COUNTS=PASS events=1 ledger=1 settlements=1'
fi

mkdir -p evidence
hash_value() {
  printf '%s' "$1" | sha256sum | awk '{print $1}'
}

paypal_order_hash=$(hash_value "$PAYPAL_ORDER_ID")
capture_hash=$(hash_value "$CAPTURE_ID")
project_hash=$(hash_value "$PROJECT_ID")
payment_order_hash=$(hash_value "$PAYMENT_ORDER_ID")
ledger_hash=$(hash_value "$LEDGER_ID")
settlement_hash=$(hash_value "$SETTLEMENT_ID")

jq -n \
  --arg subject_sha "$GITHUB_SHA" \
  --arg run_id "$GITHUB_RUN_ID" \
  --arg observed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg paypal_order_sha256 "$paypal_order_hash" \
  --arg capture_sha256 "$capture_hash" \
  --arg project_sha256 "$project_hash" \
  --arg payment_order_sha256 "$payment_order_hash" \
  --arg ledger_sha256 "$ledger_hash" \
  --arg settlement_sha256 "$settlement_hash" \
  --arg capture_mode "$([ "$AUTOMATIC_MODE" = true ] && printf automatic_sandbox || printf supervised_sandbox)" \
  --arg replay_status "${WEBHOOK_REPLAY_STATUS:-NOT_RUN}" \
  --arg mismatch_test_status "${MISMATCH_NEGATIVE_TEST_STATUS:-NOT_RUN}" \
  '{
    schema:"jadel.paypal.real-sandbox.sales-to-cash.v1",
    status:"PASS",
    subject_sha:$subject_sha,
    workflow_run_id:$run_id,
    observed_at:$observed_at,
    paypal_environment:"sandbox",
    capture_mode:$capture_mode,
    exactly_once_checks:(if $capture_mode=="automatic_sandbox" then {
      webhook_replay:$replay_status,
      amount_mismatch_negative_contract_test:$mismatch_test_status,
      payment_events:1,
      ledger_entries:1,
      settlements:1
    } else null end),
    authority:{
      paypal_live_credentials_used:false,
      real_money_movement:false,
      production_financial_mutation:false,
      cloudflare_sandbox_resources_mutated:true,
      human_buyer_approval_required:true
    },
    path:[
      "POLICY_ALLOWED",
      "QUOTED",
      "CUSTOMER_APPROVED",
      "PAYMENT_PENDING",
      "PAYPAL_SANDBOX_CAPTURE_COMPLETED",
      "VERIFIED_WEBHOOK",
      "MATCHED",
      "PAID"
    ],
    identifiers_sha256:{
      paypal_order:$paypal_order_sha256,
      capture:$capture_sha256,
      project:$project_sha256,
      payment_order:$payment_order_sha256,
      ledger:$ledger_sha256,
      settlement:$settlement_sha256
    }
  }' > evidence/paypal-real-sandbox-sales-to-cash.json

sha256sum evidence/paypal-real-sandbox-sales-to-cash.json | tee evidence/paypal-real-sandbox-sales-to-cash.sha256
echo 'PAYPAL_SANDBOX_SALES_TO_CASH_CERTIFICATION=PASS'
