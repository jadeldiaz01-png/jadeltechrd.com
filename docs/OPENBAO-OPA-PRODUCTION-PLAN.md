# OpenBao + OPA production plan

## OpenBao

Target identities are workload identities, not shared static service tokens. Minimum roles: control, research, execution, migration, backup, observability and CI. Each role receives only the secret paths and cryptographic capabilities needed for its workload.

Production activation requires TLS, HA storage, initialization/unseal procedure, workload authentication, key rotation, backup/restore, audit devices, monitoring and break-glass governance. Audit must have redundant reliable sinks because OpenBao intentionally treats inability to audit as a security-critical condition.

## OPA

OPA is the policy decision point; application services are enforcement points. External or critical actions must fail closed when policy is unavailable, malformed or stale beyond the accepted policy age.

Production policy distribution should use versioned signed bundles. CI builds/tests/formats/signs bundles; runtime verifies signatures and exposes bundle revision through health/status. Decision logs must carry decision IDs and trace correlation and must mask sensitive inputs before export.

## Promotion sequence

1. local policy/unit tests;
2. signed-bundle build verification;
3. sandbox OPA/OpenBao deployment;
4. workload-identity issuance and least-privilege tests;
5. audit-device failure tests;
6. policy-unavailable/stale-bundle fail-closed tests;
7. decision-log/evidence correlation;
8. backup/restore and key-rotation drill;
9. controlled production canary;
10. human approval for production activation.

No repository policy file alone constitutes a live OpenBao or OPA production deployment.