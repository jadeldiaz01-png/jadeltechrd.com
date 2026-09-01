path "kv/data/migration/*" {
  capabilities = ["read"]
}

path "kv/metadata/migration/*" {
  capabilities = ["read", "list"]
}
