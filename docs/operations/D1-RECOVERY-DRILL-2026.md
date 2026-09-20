# D1 Recovery Drill 2026

## Purpose

Prove recovery without risking the production intake database.

Cloudflare D1 Time Travel is always available on the production storage backend, but an actual restore overwrites the target database in place and cancels in-flight work. Therefore a production database must never be used as a routine restore-drill target.

## Two-stage evidence model

### Stage A — read-only capability

Workflow: `.github/workflows/d1-recovery-drill-readiness.yml`.

Required GitHub configuration:

- secret `CLOUDFLARE_API_TOKEN` with the minimum permissions needed to read the dedicated D1 drill database;
- secret `CLOUDFLARE_ACCOUNT_ID`;
- variable `D1_RECOVERY_DRILL_DATABASE_NAME`, which must end in `-recovery-drill`;
- variable `D1_RECOVERY_DRILL_DATABASE_ID`.

The workflow refuses the known production name `jadel-commercial-runtime`, verifies the D1 backend reports `version=production`, retrieves a current Time Travel bookmark and retains non-secret evidence for 30 days. It never issues a restore or mutation command.

Stage A can prove `D1_TIME_TRAVEL_CAPABILITY=PASS`; it cannot prove a restore.

### Stage B — destructive restore drill on dedicated recovery database

A separate D1 database is mandatory. The drill must:

1. verify the target is the approved recovery-drill database and not production;
2. create/seed a disposable recovery marker;
3. record the pre-change Time Travel bookmark;
4. mutate only the disposable recovery marker;
5. restore the dedicated drill database to the recorded bookmark;
6. verify the post-restore state exactly matches the expected baseline;
7. record start/end timestamps and calculate measured RTO;
8. record the selected recovery point and effective RPO;
9. retain sanitized command output and hashes as evidence;
10. record the undo bookmark returned by the restore operation;
11. clean up or reprovision the drill target after evidence collection.

Stage B is implemented by `.github/workflows/d1-recovery-drill-execute.yml` and remains manual, destructive-action approval-gated and bound to the GitHub environment `d1-recovery-drill`.

The workflow requires all of the following before it can mutate anything:

- input confirmation exactly `DESTROY_RECOVERY_DRILL_ONLY`;
- input database name exactly equal to `D1_RECOVERY_DRILL_DATABASE_NAME`;
- environment variable `ALLOW_D1_RECOVERY_DRILL=true`;
- database name ending in `-recovery-drill`;
- rejection of `jadel-commercial-runtime` and production-like names;
- UUID-shaped D1 database id;
- D1 `version=production`;
- Cloudflare API credentials supplied only through GitHub secrets.

The destructive restore uses Cloudflare's Time Travel REST API so the JSON response can be retained and the `previous_bookmark` (undo point) can be certified. Data mutation and correctness probes use pinned Wrangler `4.135.0`. The workflow measures recovery-point age and RTO, creates a deterministic evidence bundle, generates a GitHub/Sigstore attestation, verifies that attestation against the exact repository/workflow/SHA/ref, and retains the evidence for 90 days.

Execution remains blocked until the dedicated database and protected GitHub environment are provisioned and a human explicitly approves the destructive drill.

## Production gate

`RESTORE_ROLLBACK_DRILL` remains `NOT_YET_CERTIFIED` until Stage B has a successful evidence bundle no older than 30 days.

Read-only Time Travel capability is useful evidence but is not equivalent to a tested restore.

## Longer retention

Native Time Travel retention is plan-dependent. Where required retention exceeds the native window, export D1 state to controlled object storage such as R2 with encryption, retention policy, integrity hashes and a tested import/recovery procedure.

## Safety rules

- Never perform a routine recovery drill against `jadel-commercial-runtime`.
- Never log Cloudflare tokens or account credentials.
- Never treat a successful `d1 time-travel info` call as proof that restore works.
- A restore drill is not PASS until data correctness and measured RPO/RTO are recorded.
- Restore evidence must be tied to the exact workflow revision and drill database identity without exposing secrets.


## 2026 implementation notes

Cloudflare documents Time Travel as always-on for D1 production storage and explicitly warns that restore overwrites the selected database in place and cancels in-flight work. The restore response includes a previous bookmark that can be used to undo the restore. This is why the production intake database is categorically rejected by the drill workflow.

Current stable Wrangler pin validated for this control-plane update: `4.135.0` (released 2026-09-18). The Time Travel API, rather than interactive CLI restore, is the authority used for the destructive restore response and undo-bookmark evidence.

Longer-than-native retention should use scheduled D1 export to R2/controlled object storage with integrity hashes and tested import/recovery. Native Time Travel retention remains plan-dependent.
