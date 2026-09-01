path "kv/data/research/*" {
  capabilities = ["read"]
}

path "kv/metadata/research/*" {
  capabilities = ["read", "list"]
}
