# SLO Multiwindow Burn-Rate Hardening 2026

## Purpose

Harden the public-domain SLO/error-budget certifier without changing the 30-day maturity requirement, the governed 10-minute synthetic cadence, the 4,320 expected slots, the 95% minimum coverage, or the 30-minute maximum blind gap.

This change does not authorize production. It only improves the quality of the burn-rate decision consumed by the existing fail-closed production gate.

## Decision

The certifier uses paired long and short windows. A burn rule is active only when both windows exceed the same burn-rate threshold.

Rules:

| Severity | Long window | Short window | Burn rate | 30-day budget fraction |
| --- | ---: | ---: | ---: | ---: |
| page | 1h | 10m | 14.4x | 2% |
| page | 6h | 30m | 6x | 5% |
| ticket | 24h | 2h | 3x | 10% |
| ticket | 72h | 6h | 1x | 10% |

Google SRE's canonical starting point uses 1h/5m at 14.4x and 6h/30m at 6x, with slower ticket windows. The first short window is intentionally 10m here because the governed synthetic observation cadence is 10 minutes; a 5-minute short window would be structurally undersampled and would create false confidence.

The existing 10-minute cadence is preserved because changing sampling semantics after bootstrap would add operational churn without changing the elapsed-time requirement. GitHub Actions supports schedules as frequent as every five minutes, so a future sampling-version migration remains possible if separately justified by cost, coverage, and migration evidence.

## Anti-gaming and fail-closed properties

- Only scheduled first-attempt samples count toward certification.
- Retries cannot replace an SLI sample.
- Missing scheduled observations reduce coverage instead of being inferred healthy.
- Every configured burn-rule window must be sufficiently covered before certification can be ready.
- A historical spike whose short window has recovered does not remain an active burn alert.
- A current spike present in both long and short windows does block certification.
- Overall 30-day availability, latency, error-budget, hard-invariant, coverage, maximum-gap and alert-delivery requirements remain mandatory.
- Alert delivery remains independently proven by the existing attested GitHub Issue create/read/comment/close round trip.
- The certifier cannot promote the manifest itself; human production review remains required.

## Evidence and tests

Deterministic fixtures cover:

- perfect 30-day evidence;
- missing daily evidence / blind gap;
- exhausted 30-day error budget;
- stale alert-delivery evidence;
- historical spike with recovered short window;
- active fast burn present in both paired windows.

## Production boundary

The public-domain gate remains NOT_YET_CERTIFIED until the full eligible 30-day scheduled measurement window exists and passes all controls.

Agents, external connectors/publication, social-media automation, commercial-runtime promotion, and quant/trading are independent authorization domains. No public-site SLO PASS grants live financial capital, autonomous publication, or trading execution.

## Primary references

- Google SRE Workbook, “Alerting on SLOs”: https://sre.google/workbook/alerting-on-slos/
- GitHub Actions workflow syntax, scheduled workflows: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
