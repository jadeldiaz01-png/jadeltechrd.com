# D1 Recovery Drill 2026

## Purpose

Prove database recovery with measured evidence while making it mechanically impossible for the routine drill to target the production intake database.

Cloudflare D1 Time Travel is the point-in-time recovery mechanism. It is always on for supported production-storage D1 databases. A restore is destructive and overwrites the target database in place, so the production database `jadel-commercial-runtime` is never an acceptable routine drill target.

## Dedicated target

The only approved drill database name is:

```
jadel-commercial-runtime-recovery-drill
```

Every recovery workflow independently enforces:

- exact database name above;
- suffix `-recovery-drill`;
- explicit rejection of `jadel-commercial-runtime`;
- exact identity discovery through `wrangler d1 list --json`;
- production-storage backend verification through `wrangler d1 info --json`;
- no credentials or tokens in committed files or evidence.

Wrangler is pinned to `4.135.0` for reproducibility. Upgrades require a pull request and a new recovery certification.

## Stage 0 — provision isolated D1

Workflow: `.github/workflows/d1-recovery-drill-provision.yml`.

Manual confirmation:

```
PROVISION_ISOLATED_RECOVERY_DRILL
```

The workflow discovers the database by exact name and creates it only when absent. It never creates or modifies `jadel-commercial-runtime`. Evidence is retained for 30 days.

Required GitHub secrets:

- `CLOUDFLARE_API_TOKEN` with the minimum D1 permissions needed by the selected stage;
- `CLOUDFLARE_ACCOUNT_ID`.

The job uses the GitHub environment `d1-recovery-drill`. Configure required reviewers for that environment where the repository plan supports environment protection.

## Stage A — read-only recovery capability

Workflow: `.github/workflows/d1-recovery-drill-readiness.yml`.

Manual confirmation:

```
READ_ONLY_RECOVERY_CHECK
```

Stage A verifies:

1. isolated database identity;
2. D1 production storage backend;
3. current Time Travel bookmark;
4. non-production target invariant.

It never calls `d1 time-travel restore` and never mutates D1.

A Stage A success proves `D1_TIME_TRAVEL_CAPABILITY=PASS`; it does not prove restore correctness.

## Stage B — certified destructive restore on the isolated D1

Workflow: `.github/workflows/d1-recovery-drill.yml`.

Manual confirmation:

```
RESTORE_DEDICATED_RECOVERY_DRILL
```

The workflow:

1. re-verifies exact database identity and non-production target;
2. creates a dedicated marker table and seeds a unique `BASELINE` marker;
3. confirms the baseline by a remote read;
4. captures a Time Travel bookmark;
5. mutates the marker to `MUTATED` and proves divergence;
6. restores only the isolated database to the captured bookmark;
7. polls until the application-level state is again `BASELINE`;
8. proves the mutated state is absent;
9. records the undo bookmark returned by the restore;
10. measures selected recovery-point age as the drill RPO metric;
11. measures restore-start to verified-read completion as RTO;
12. builds SHA-256 evidence;
13. creates a GitHub/Sigstore attestation for the recovery evidence tar;
14. cryptographically verifies repository, workflow, source SHA and source ref before retaining the artifact.

The evidence artifact is retained for 90 days.

## PASS criteria

`RESTORE_ROLLBACK_DRILL=PASS` requires all of the following in one run:

- `D1_RESTORE_HUMAN_GATE=PASS`;
- `D1_RESTORE_TARGET_ISOLATION=PASS`;
- `D1_EXACT_RECOVERY_IDENTITY=PASS`;
- `D1_BASELINE_AND_BOOKMARK=PASS`;
- `D1_CONTROLLED_MUTATION=PASS`;
- `D1_RESTORE_DRILL=PASS`;
- non-negative measured RPO and RTO;
- `production_database_touched=false`;
- `D1_RECOVERY_EVIDENCE_BUNDLE=PASS`;
- `D1_RECOVERY_ATTESTATION_VERIFY=PASS`.

No skipped, inferred or documentation-only result is a PASS.

## Operational interpretation of RPO/RTO

For this controlled drill:

- **selected recovery-point age** measures how old the selected bookmark is at restore start. This is the observed drill RPO, not a contractual guarantee for every incident.
- **measured RTO** measures elapsed time from restore invocation to a successful application-level verification query.

Production SLO/SLA values must be set from repeated drills and real operational requirements, not from one favorable run.

## Longer retention

Native Time Travel retention depends on plan. If business retention requirements exceed the native window, use controlled D1 export to object storage such as R2, with encryption, integrity hashes, retention policy and a tested import/recovery path.

## Safety invariants

- Never run the routine restore drill against `jadel-commercial-runtime`.
- Never change the target through a free-form workflow input.
- Never log Cloudflare credentials.
- Never treat `time-travel info` as restore proof.
- Never mark recovery PASS without data-level verification and measured RPO/RTO.
- Never authorize production solely because recovery passed; all other domain gates remain independent.
