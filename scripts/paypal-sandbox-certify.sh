#!/usr/bin/env bash
set -euo pipefail

token=$(printf '%s' "$CLOUDFLARE_D1_API_TOKEN_RAW" | tr -d '\r\n' | sed -E 's/^[[:space:]]*Bearer[[:space:]]+//I; s/^[[:space:]]+//; s/[[:space:]]+$//')
account_id=$(printf '%s' "$CLOUDFLARE_ACCOUNT_ID_RAW" | tr -d '\r\n[:space:]')
test -n "$token" || { echo 'CLOUDFLARE_D1_TOKEN_PRESENT=NO' >&2; exit 2; }
test -n "$account_id" || { echo 'CLOUDFLARE_ACCOUNT_ID_PRESENT=NO' >&2; exit 2; }
for value in "$token" "$account_id"; do echo "::add-mask::$value"; done

for required in "$DATABASE_ID" "$PROJECT_ID" "$PAYMENT_ORDER_ID" "$LEDGER_ID" "$SETTLEMENT_ID" "$PAYPAL_ORDER_ID" "$CAPTURE_ID"; do
  test -n "$required" || { echo 'PAYPAL_SANDBOX_CERTIFICATION_INPUT_MISSING=YES' >&2; exit 3; }
done

payload=$(jq -n \
  --arg project "$PROJECT_ID" \
  --arg po "$PAYMENT_ORDER_ID" \
  --arg ledger "$LEDGER_ID" \
  --arg settlement "$SETTLEMENT_ID" \
  '{sql:"SELECT p.state AS project_state,po.status AS payment_order_status,l.ledger_state,e.event_type,e.verification_status,s.status AS settlement_status FROM project_requests p JOIN payment_orders po ON po.project_id=p.project_id JOIN sales_settlements s ON s.payment_order_id=po.payment_order_id JOIN payment_ledger l ON l.ledger_id=s.ledger_id JOIN payment_events e ON e.provider_event_id=l.provider_event_id WHERE p.project_id=? AND po.payment_order_id=? AND l.ledger_id=? AND s.settlement_id=? LIMIT 1",params:[$project,$po,$ledger,$settlement]}')

result=$(curl --fail-with-body -sS -X POST \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  --data "$payload" \
  "https://api.cloudflare.com/client/v4/accounts/$account_id/d1/database/$DATABASE_ID/query")
test "$(jq -r '.success' <<<"$result")" = true
row=$(jq -c '.result[0].results[0]' <<<"$result")
test "$row" != null
test "$(jq -r '.project_state' <<<"$row")" = PAID
test "$(jq -r '.payment_order_status' <<<"$row")" = COMPLETED
test "$(jq -r '.ledger_state' <<<"$row")" = MATCHED
test "$(jq -r '.event_type' <<<"$row")" = PAYMENT.CAPTURE.COMPLETED
test "$(jq -r '.verification_status' <<<"$row")" = VERIFIED
test "$(jq -r '.settlement_status' <<<"$row")" = MATCHED

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
  '{
    schema:"jadel.paypal.real-sandbox.sales-to-cash.v1",
    status:"PASS",
    subject_sha:$subject_sha,
    workflow_run_id:$run_id,
    observed_at:$observed_at,
    paypal_environment:"sandbox",
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
echo 'PAYPAL_REAL_SANDBOX_SALES_TO_CASH=PASS'
