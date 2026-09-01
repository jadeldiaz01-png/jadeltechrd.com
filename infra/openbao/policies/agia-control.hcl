path "kv/data/control/*" {
  capabilities = ["read"]
}

path "kv/metadata/control/*" {
  capabilities = ["read", "list"]
}

path "transit/encrypt/control-plane" {
  capabilities = ["update"]
}

path "transit/decrypt/control-plane" {
  capabilities = ["update"]
}
