path "kv/data/execution/*" {
  capabilities = ["read"]
}

path "kv/metadata/execution/*" {
  capabilities = ["read", "list"]
}

path "transit/encrypt/external-action-intent" {
  capabilities = ["update"]
}

path "transit/decrypt/external-action-intent" {
  capabilities = ["update"]
}
