path "kv/data/ci/*" {
  capabilities = ["read"]
}

path "kv/metadata/ci/*" {
  capabilities = ["read", "list"]
}

path "transit/sign/artifact-signing" {
  capabilities = ["update"]
}

path "transit/verify/artifact-signing" {
  capabilities = ["update"]
}
