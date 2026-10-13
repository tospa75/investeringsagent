# Task 16 – Production deployment validation

Generated: 2026-10-13

## Status

`PARTIAL_EXTERNAL_VALIDATION`

The application is deployed and the principal production workflow is verified. Task 16 cannot yet be closed because no real Vercel Cron invocation has reached the database and a cloud WebKit run has not been executed.

## Deployment

- Production URL: https://investeringsagent.vercel.app
- Platform: Vercel Hobby, Next.js preset, repository root
- GitHub: `tospa75/investeringsagent`, branch `main`
- Deployed commit: `7a7a3b22d4d48d745c0919fedf52c7652531d6b7`
- HTTPS: PASS
- `/api/health`: HTTP 200, database reachable, commit SHA and request ID present
- Production security headers: PASS (HSTS, `nosniff`, frame denial, referrer policy and permissions policy)
- Separate preview deployment/database: not configured; production is validated directly with isolated temporary users

## Production E2E

- Supabase login/logout: PASS
- Session and data persistence after logout/login: PASS
- Profile save and automatic workflow: PASS
- Filter, score and portfolio proposal: PASS; workflow reached `COMPLETED`
- Proposal visibility and target weights: PASS
- Portfolio creation: PASS after fixing partial-index idempotency handling in commit `8fb4302`
- Two BUY transactions: PASS (NOK 10,000 and NOK 15,000)
- Snapshot and dashboard: PASS; NOK 25,000 shown after fixing latest intraday snapshot selection in commit `7a7a3b2`
- Monitoring page: PASS; no trade was executed
- Profile edit/version regeneration: not repeated in cloud during this closeout
- All temporary production users and dependent test data: deleted

## Browser and mobile matrix

| Target | Status | Detail |
|---|---|---|
| Chromium-compatible cloud browser | PASS | Login, profile workflow, proposal, portfolio, two transactions, persistence and monitoring verified against production |
| Mobile viewport 390×844 | PASS | No horizontal overflow; mobile navigation and forms rendered |
| Playwright Chromium CLI | BLOCKED_LOCAL_SANDBOX | Local macOS Mach-port sandbox prevents browser launch before navigation |
| WebKit / iPhone | NOT_RUN_CLOUD | Local WebKit is blocked by the same sandbox and no external CI browser runner is configured |

## PWA

- Manifest over HTTPS: PASS
- `start_url=/`, `scope=/`, standalone display and theme/background metadata: PASS
- 192×192 and 512×512 icons: PASS
- Service worker served over HTTPS: PASS
- Cache safety: PASS; only static manifest/icon assets are cached, not navigation, API, Supabase auth tokens or private portfolio payloads
- Native install prompt/install action: not manually exercised

## Security

- Two-user production RLS isolation: PASS for profiles, portfolios and transactions, including cross-user reads/writes
- Unauthenticated cron request: HTTP 401, PASS
- Deployed client bundle scan: no `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `JOBS_ADMIN_SECRET` or `service_role` references
- `.env.local`, test credentials, build output and reports containing secrets: excluded from Git as appropriate
- No test credentials remain active

## Scheduler and cron

- Local/live scheduler chain previously passed for `NAV_INGESTION → PERFORMANCE_METRICS → PORTFOLIO_SNAPSHOT → PORTFOLIO_MONITORING`, plus rebalancing
- Vercel cron route: configured at `/api/cron/maintenance`, daily at 04:00 UTC
- Authorized real Vercel Cron invocation: **PENDING**
- Database check: 0 `job_runs` with `triggered_by = SCHEDULE`
- Therefore cloud-originated scheduler chain and secret-free Vercel logs remain pending

## Release gate

- Tests: 33 files, 190 tests passed
- TypeScript: PASS
- Production build: PASS
- Production dependency audit: 0 vulnerabilities
- Git/client secret audit: PASS
- Documentation: `docs/deployment.md` updated

## Operations

- Vercel Hobby and Supabase Free are adequate for the current validation-sized workload; function duration and cron frequency must be monitored as ingestion volume grows.
- Preview currently shares no separate isolated Supabase project. A separate preview project is recommended before team testing.
- Vercel deployment rollback is documented. Database migrations are forward-only and require reviewed compensating migrations.
- Supabase backup/export readiness is documented; no automatic external backup was added.

## Remaining closeout actions

1. Trigger `/api/cron/maintenance` from Vercel with its configured Cron authorization (or allow the scheduled 04:00 UTC run).
2. Confirm a completed `SCHEDULE` job run and representative cloud maintenance chain without secrets in logs.
3. Run the production E2E suite in a WebKit-capable external runner (and preferably Chromium Playwright there as well).
4. Optionally exercise the native PWA install prompt and a dedicated preview deployment.

Task 17 has not been started.
