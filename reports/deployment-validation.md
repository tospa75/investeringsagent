# Task 16 – Production deployment validation

Generated: 2026-10-13

## Status

`BLOCKED_EXTERNAL_CREDENTIALS`

The application is release-ready locally, but it has not been deployed. No Git remote, Vercel project link, Vercel token, or usable Vercel CLI login is available. Per Task 16, deployment stops at this external access step; this is not an application defect.

## Git and build identity

- Local repository: initialized on `main`
- Baseline commit: `03b10aa`
- Remote: not configured
- `.env.local`, `.next`, `node_modules`, Playwright output, logs, and local work files: ignored
- Secret-content scan outside `.env.local`: clean
- Vercel build identifier: will use `VERCEL_GIT_COMMIT_SHA`
- Local fallback version: `0.1.0-local`

## Deployment target

- Platform: Vercel, Next.js preset
- Root: repository root
- Install: `npm install`
- Build: `npm run build`
- Production URL: pending
- Preview URL: pending
- HTTPS: pending deployment
- Custom domain: optional, not required

## Environment readiness

Required in Preview and Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `CRON_SECRET`
- `JOBS_ADMIN_SECRET`
- `RISK_FREE_RATE_ANNUAL`
- `MINIMUM_ACCEPTABLE_RETURN_ANNUAL`

Secret values were not logged or committed. Preview may temporarily share the current Supabase project only for isolated test users with cleanup; a separate preview database is recommended before broader team testing.

## Local release gate

- Unit/integration tests: 33 files, 190 tests passed
- TypeScript: PASS
- Production build: PASS
- Production dependency audit: 0 vulnerabilities
- Health route: PASS (`status=ok`, database reachable, version and request ID present)
- Manifest: PASS (`start_url=/`, `scope=/`, standalone, five icons)
- PNG icons: valid 192×192 and 512×512
- Service worker safety: PASS; only manifest/icons are cached, navigation and API/auth/private payloads are not cached
- Client/static secret scan: no server secret values or variable references in `.next/static`

## Browser matrix

| Browser | Status | Detail |
|---|---|---|
| Chromium | BLOCKED_LOCAL_SANDBOX | Browser downloaded; macOS Mach-port sandbox denied browser launch |
| WebKit / iPhone 13 | BLOCKED_LOCAL_SANDBOX | Browser downloaded; process aborted in the restricted local sandbox |

Both failures occurred before a page opened. The existing E2E suite creates and removes dedicated users and covers login, profile creation/edit, filtering/scoring/proposal, portfolio creation, transaction, logout/login persistence, and mobile horizontal-overflow checking. It must be run against the Vercel Preview URL.

## PWA and mobile

Manifest, icons, standalone metadata, service-worker scope, and safe caching are ready. HTTPS installability, safe-area/keyboard interaction, bottom navigation, and actual iPhone/WebKit behavior remain pending the Preview deployment/browser run.

## Cloud validations pending

These require the deployment URL and cannot be truthfully reported as complete:

- HTTPS origin and security headers on Vercel
- Supabase Site URL and exact Redirect URLs
- login/logout/session persistence from cloud origin
- full profile/portfolio/monitoring E2E in Chromium and WebKit
- two-user cloud RLS test
- deployed-bundle secret audit
- real cloud-originated cron request and scheduler chain
- Vercel rollback/promotion test

## Security and operations readiness

- `/api/health` exposes only status, database reachability, build identifier, and request ID; it is non-cacheable.
- Cron/admin routes require constant-time bearer-secret verification.
- Global Vercel headers configure HSTS, `nosniff`, frame denial, strict-origin referrer policy, and a restrictive permissions policy.
- Database migrations are forward-only; rollback uses a reviewed compensating migration rather than destructive automatic reversal.
- Backup/export readiness and free-tier limits must be confirmed against the actual Supabase/Vercel account plan before real production data is stored.

## Exact external step required

The user must provide repository/deployment access by either:

1. creating a private GitHub/GitLab repository, adding it as `origin`, and signing Vercel into that provider; or
2. running `npx vercel login` locally and confirming the Vercel account/project to use.

After access exists, rerun Task 16 to configure environment variables without exposing their values, deploy Preview, update exact Supabase Auth URLs, execute browser/cloud cron/RLS validation, promote to Production, clean test data, and finalize this report.

Task 17 has not been started.
