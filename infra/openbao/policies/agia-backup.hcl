path "kv/data/backup/*" {
  capabilities = ["read"]
}

path "kv/metadata/backup/*" {
  capabilities = ["read", "list"]
}

path "transit/encrypt/backup" {
  capabilities = ["update"]
}

path "transit/decrypt/backup" {
  capabilities = ["update"]
}
