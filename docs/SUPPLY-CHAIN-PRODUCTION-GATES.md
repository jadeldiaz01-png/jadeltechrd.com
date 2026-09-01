# Software supply-chain production gates

Production changes require immutable/pinned CI dependencies where practical, dependency review, secret scanning, code scanning, reproducible build inputs, SBOM generation, provenance/attestation for release artifacts, artifact digest verification at deployment and protected-branch review/status gates.

CI identities are separate from runtime identities and cannot inherit broad production secrets by default. Deployment credentials are environment-scoped and least-privilege. Secrets are never committed, echoed or copied into artifacts/logs.

High-risk dependency upgrades, action changes, policy-engine updates and deployment-tool upgrades receive explicit review and smoke/canary evidence. Build/test artifacts do not become trusted production artifacts solely because CI passed; provenance and deployment identity must match the approved source revision.

Emergency changes retain auditability, rollback and post-incident review rather than bypassing controls permanently.