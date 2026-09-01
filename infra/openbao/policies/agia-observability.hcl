path "kv/data/observability/*" {
  capabilities = ["read"]
}

path "kv/metadata/observability/*" {
  capabilities = ["read", "list"]
}
