# Task 15 – Scheduler validation

Generated: 2026-10-13

## Architecture

Vercel Cron is the cloud wake-up mechanism. It calls `GET /api/cron/maintenance` daily at 04:00 UTC. The code registry and `scheduled_jobs.next_run_at` are the authoritative per-job cadence model; the daily Vercel call only wakes the orchestrator. Both cron and manual endpoints require a constant-time checked bearer secret. The Supabase service key remains server-only.

Event-driven profile workflows from Task 14C are unchanged and separate from scheduled maintenance. This task does not trade, notify users, or invoke an AI recommendation layer.

## Schedule matrix

| Job | Registry schedule | Cadence | Dependencies |
|---|---|---:|---|
| KRON_FUND_DISCOVERY | `0 4 * * 1,4` | 3 days | – |
| KID_DISCOVERY | `20 4 * * *` | daily | Kron (non-critical) |
| KID_PARSING | `40 4 * * *` | daily check; parser skips unchanged input | KID discovery (critical) |
| EXPOSURE_INGESTION | `0 5 * * 0` | weekly | – |
| NAV_INGESTION | `0 5 * * 1-5` | daily | – |
| PERFORMANCE_METRICS | `20 5 * * 1-5` | after NAV | NAV (critical) |
| PORTFOLIO_SNAPSHOT | `40 5 * * 1-5` | after metrics | Metrics (critical) |
| PORTFOLIO_MONITORING | `0 6 * * 1-5` | after snapshot | Snapshot (critical) |
| REBALANCE_EVALUATION | `20 6 * * 1-5` | after monitoring | Monitoring (critical) |
| MAINTENANCE_CLEANUP | `0 3 * * 0` | weekly | – |

## Dependency graph

`NAV → metrics → active, non-empty portfolio snapshot → monitoring → rebalance evaluation`

`KID discovery → KID parsing`

Critical downstream work is skipped after a missing or failed upstream run. A partial upstream run is allowed so valid funds continue; failures remain isolated and visible per item.

## Reliability and safety

- Deterministic run keys include job type, data version, target, and a schedule/manual time bucket.
- Supabase lease locks prevent concurrent runs; expired leases are recoverable by the lock RPC.
- Transient network, timeout, HTTP 429, and 5xx errors use bounded exponential retry. Parser/invariant errors do not retry.
- Fund batches run conservatively in sequence. Provider circuit state opens after five consecutive failures and cools down for 30 minutes.
- Incremental repositories retain their existing content-hash/date uniqueness behavior. Metrics only recalculate for newer NAV data; empty portfolios are skipped.
- Detailed `job_run_items` are retained for 90 days. Summary runs and regulatory/document revision history are not deleted.
- Admin run and status APIs are server-secret protected; scheduler tables have RLS with no public policies.

## Freshness and material changes

Freshness is evaluated for fund universe, KID, exposure, NAV, metrics, and portfolio snapshots as `FRESH`, `STALE`, `VERY_STALE`, or `MISSING`. Monitoring writes deduplicated stale-data events without sending notifications.

Material events cover PRIIP risk changes, holding-period changes, annual-fee changes greater than 0.10 percentage points, availability `true → false`, management-style changes, benchmark changes, invalid KID, new document versions, and NAV anomalies.

## Simulated validation

- Complete nine-job flow: PASS
- Dependency ordering: PASS
- Critical failure blocking: PASS
- Partial upstream continuation: PASS
- Per-item failure isolation: PASS
- Retry/backoff/max attempts: PASS
- Deterministic duplicate prevention: PASS
- Stale lease recovery policy: PASS
- Health/freshness/materiality: PASS
- Empty portfolio skip: PASS
- Cleanup retention: PASS

## Live database and run history

Migration `202610130001_scheduler.sql` is active. All ten jobs are enabled. Unique deterministic keys, status/trigger checks, foreign keys, indexes, RLS, and the service-role-only lock RPC were exercised successfully.

| Table | Rows |
|---|---:|
| scheduled_jobs | 10 |
| job_runs | 19 |
| job_run_items | 19 |
| job_locks | 0 |
| provider_circuit_breakers | 1 (`KRON`, closed) |
| data_quality_events | 0 |
| portfolio_monitoring_events | 0 after cleanup |

All run rows have status, start/end, duration, attempt, trigger, counts, and a unique deterministic key. Invalid rows: 0. Duplicate keys: 0.

## Dry-run and live validation

The initial dry-run contained all ten seeded jobs in dependency order and changed no table counts. After live execution, only cleanup remained due.

An isolated temporary user and active portfolio with one open position in `NO0011101545` validated the complete maintenance chain. The first run inserted 9 new NAV dates, 1 metrics version, 1 snapshot, 1 monitoring event, and 1 rebalance plan. KID and exposure succeeded; Kron completed `PARTIAL` with expected quality 86 and no item error. No trade was executed.

Second-run deltas were 0 documents, 0 exposure datasets, 0 NAV points, 0 metrics, 0 data-quality events, 0 snapshots, 0 monitoring events, and 0 rebalance plans. A follow-up unchanged KID run returned `SKIPPED – Document content already parsed` before PDF parsing.

The temporary user, transaction, portfolio, snapshot, monitoring event, proposal, and rebalance plan were removed. Remaining temporary portfolios, proposals, and locks: 0. Scheduler audit history was retained.

## Live health and freshness

- HEALTHY: KID discovery/parsing, exposure, NAV, metrics, snapshot, monitoring, rebalance
- DEGRADED: Kron discovery (expected `PARTIAL`, quality 86)
- NEVER_RUN: cleanup; destructive live cleanup was unnecessary, while its 90-day selection logic is tested
- FRESH: fund universe, KID, exposure, NAV, metrics
- MISSING: portfolio snapshot after intentional test cleanup; no real active portfolios exist

## Locks, retry and circuit breaker

- First lease acquired, concurrent duplicate rejected, expired lease recovered, final locks 0.
- Network, 429, timeout, and 5xx use bounded exponential retry; max attempts and non-retryable validation failure are tested.
- Five simulated provider failures opened the breaker; another provider continued; cooldown and successful reset passed.
- Provider work remains sequential and item failures remain isolated.

## Security and route verification

- Anonymous scheduler-table read returned 0 rows; anonymous lock RPC was rejected.
- Unauthorized cron/admin requests returned HTTP 401.
- Authorized dry-run calls returned HTTP 200 and reached the backend.
- `SUPABASE_SECRET_KEY` was absent from application/client/static bundle searches.
- No secrets were logged.

## Final verification

- Tests: 33 files, 190 tests passed
- TypeScript: PASS
- Production build: PASS
- Production dependency audit: 0 vulnerabilities
- Cron, manual trigger, and status routes compiled and passed local production-server checks

Task 15 can be closed. The only external blocker is absence of a deployed Vercel environment for a cloud-originated trigger; configure `CRON_SECRET` when deploying. Task 16 has not been started.
