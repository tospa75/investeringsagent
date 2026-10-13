# Vercel deployment

The application uses Vercel for HTTPS hosting and the daily cloud wake-up of the Supabase-backed scheduler. The detailed cadence remains authoritative in the application registry/database.

## Initial deployment

1. Push the repository to a private GitHub or GitLab repository.
2. Import it in Vercel with the Next.js preset and repository root as project root.
3. Keep the default install command (`npm install`) and build command (`npm run build`).
4. Configure environment variables before deploying.
5. Deploy Preview first, validate it, and then promote the same tested commit to Production.

## Environment variables

Configure these for both Preview and Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `CRON_SECRET`
- `JOBS_ADMIN_SECRET` (recommended distinct manual-admin secret)
- `RISK_FREE_RATE_ANNUAL`
- `MINIMUM_ACCEPTABLE_RETURN_ANNUAL`

`SUPABASE_SECRET_KEY`, `CRON_SECRET`, and `JOBS_ADMIN_SECRET` are server-only. Never prefix them with `NEXT_PUBLIC_`, expose them in browser code, commit them, or paste them into logs. Vercel supplies `VERCEL_GIT_COMMIT_SHA` as the build identifier. `NEXT_PUBLIC_APP_VERSION` is only a local/non-Vercel fallback.

Using the same Supabase project for the first Preview and Production phase is acceptable only for controlled validation with clearly named test users and full cleanup. A separate Supabase preview project is recommended before team development or broader testing.

## Supabase Auth

Set the production deployment origin as **Site URL**. Add only the exact required callback origins under **Redirect URLs**:

- `https://<production-host>`
- the specific active preview URL while validating it

Avoid broad wildcard redirects. Remove obsolete preview origins after validation.

## Validation

Run against the Preview URL:

```text
PLAYWRIGHT_BASE_URL=https://<preview-host> npm run test:e2e
```

Validate Chromium and WebKit/mobile, `/api/health`, manifest, icons, service-worker registration, authentication persistence, profile workflow, portfolio transactions, monitoring, RLS isolation, and cron authorization. All E2E users/data must carry a test identifier and be deleted afterward.

The service worker caches only the manifest and public icon assets. It deliberately ignores navigation requests and does not cache API responses, Supabase authentication tokens, or private portfolio payloads.

## Cron

Vercel calls `GET /api/cron/maintenance` daily at 04:00 UTC and sends `Authorization: Bearer <CRON_SECRET>`. An unauthenticated request must return 401. Confirm a real cloud invocation creates and completes a `job_runs` row without logging secret material.

## Health and tracing

`GET /api/health` returns only application status, database reachability, build identifier, and a request ID. It is non-cacheable and does not expose connection details or secret values.

## Rollback

Use Vercel deployment history to promote the previously verified deployment. Verify `/api/health` and login immediately afterward. Application rollback does not roll back Supabase migrations. Database migrations are forward-only by default; prepare and review a separate compensating migration when rollback is genuinely required. Never run destructive database rollback automatically.

## Backup readiness

Before material production usage, verify the active Supabase plan's backup/PITR capabilities and periodically test an export/restore procedure. Free-tier backup guarantees can differ from paid plans; an external encrypted export policy should be added before storing irreplaceable production data. Google Drive backup is not part of Task 16.

## Free-tier considerations

The current low-volume MVP uses one daily Vercel cron wake-up, sequential external requests, and bounded function execution. This is designed for low cloud usage, but actual Vercel cron/function allowances and Supabase quotas must be checked against the account's current plan before launch. Do not upgrade automatically.

## Troubleshooting

- Build fails: reproduce with `npm ci && npm run build` using the same Node version.
- Health is degraded: verify Supabase URL/secret scopes and that scheduler migration `202610130001_scheduler.sql` is applied.
- Login redirect fails: check exact Supabase Site URL/Redirect URL entries.
- Cron returns 401: ensure the Vercel `CRON_SECRET` and deployed environment value match.
- PWA update appears stale: verify `/sw.js` has `Cache-Control: public, max-age=0, must-revalidate`.
