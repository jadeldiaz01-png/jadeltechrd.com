#!/usr/bin/env bash

paypal_require_prepare_provider_status() {
  local observed="${1:-}"
  printf 'PAYPAL_SANDBOX_PROVIDER_STATUS_OBSERVED=%s\n' "$observed"

  case "$observed" in
    CREATED|PAYER_ACTION_REQUIRED)
      return 0
      ;;
    *)
      printf 'PAYPAL_SANDBOX_PROVIDER_STATUS_INVALID=%s\n' "$observed" >&2
      return 42
      ;;
  esac
}
