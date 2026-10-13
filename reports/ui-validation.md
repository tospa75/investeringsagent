# Task 14C – Workflow integration and final E2E

Generated: 2026-10-12

## Result

The authenticated UI remains fixture-free and profile changes now invoke the existing Task 09, 10B and 11B engines automatically. Migration `202610120004_profile_workflows.sql` was applied successfully to Supabase.

## Workflow integration

- **Profile → filtering:** profile input is validated, saved as an immutable version, and evaluated by the existing `FilterRepository` and `evaluateFund` engine.
- **Filtering → scoring:** only PASS funds for the exact profile version are loaded and scored by the existing Task 10B engine.
- **Scoring → portfolio construction:** current-version scores and preferences are passed to the existing Task 11B construction engine.
- **Status:** `PROFILE_SAVED`, `FILTERING`, `SCORING`, `BUILDING_PORTFOLIO`, `COMPLETED`, `PARTIAL`, or `FAILED` is persisted with stage, error, attempt count and timestamps.
- **Retries:** FILTER, SCORE and PORTFOLIO can be retried independently. Retry resumes at the failed stage and keeps downstream writes idempotent.
- **Idempotence:** one deterministic workflow exists per profile/version. A repeated call returned the same workflow id.
- **Race safety:** every downstream stage checks the active profile version. A deliberately stale V1 retry after V2 was saved became `PARTIAL` with a superseded error and did not overwrite V2.

## Profile editing

- The wizard loads the normalized profile through `/api/profile`, including hard constraints, soft management preference and portfolio preference inputs.
- Saving a real change creates a new profile, preference and constraint version while retaining prior rows.
- Saving semantically identical values with a different mutation key creates no new profile version.
- Settings show the current profile version, latest workflow result/date, score model and portfolio model.

## Complete backend E2E

Disposable live test result: **PASS**.

| Step | Result |
|---|---|
| Create/authenticate user | PASS |
| Profile V1 + preferences/constraints | PASS |
| Identical save | 0 new versions |
| Filter → score → proposal | COMPLETED |
| Duplicate workflow call | same workflow id |
| Profile V2 and new workflow | COMPLETED |
| Stale V1 retry | PARTIAL/superseded |
| Current proposal | 3 funds |
| Actual portfolio + BUY | 1 transaction |
| Snapshot | 1 inserted |
| Monitor/rebalance | 1 plan, 1 event |
| Cleanup | temporary user and dependent rows removed |

Peak versioned rows for the disposable profile were 2 revisions, 2 workflows, 36 filter results, 36 scores and 4 proposals.

## Transaction integration

The transaction API verifies ownership with the authenticated client, saves the transaction under user RLS, and then performs the derived snapshot calculation through the server-only client. The E2E test exposed and verified this separation.

## Browser E2E and Safari

- The final Playwright test now covers login, new profile, automatic workflow, profile prefill/edit, proposal, portfolio creation, BUY, dashboard refresh, logout/login persistence and mobile overflow.
- Chromium was attempted again with the installed browser. macOS denied its Mach rendezvous before page creation (`Permission denied (1100)`). No application assertion ran or failed.
- Native Safari previously verified the live login page, labels and submit control.
- Authenticated Safari pages (wizard/edit, dashboard, bottom navigation, transaction and portfolio detail) remain unverified manually because no reusable test login was retained.

## Deployment

- `vercel.json` and external-preview-aware Playwright configuration are present.
- Required variables are documented in `docs/deployment.md`.
- No `VERCEL_*` or `NOW_*` credentials were available, so no preview was deployed.
- After a preview is deployed, set `PLAYWRIGHT_BASE_URL` to its HTTPS URL and run `npm run test:e2e`.

## PWA

- 192×192 PNG: present.
- 512×512 PNG: present.
- Standalone manifest and root scope: present.
- Service worker: present; static shell only, no authenticated API/navigation cache.
- Root service-worker scope header: configured for Vercel.
- HTTPS requirement outside localhost: documented.

## Security regression

- Cross-user read denial: PASS for profiles, portfolios and transactions.
- Cross-user write denial: PASS for profiles, portfolios, transactions and monitoring.
- RLS remains enabled and active.
- Service key usage is confined to server-only modules and trusted validation scripts.
- No service secret appears in the client application source.

## Verification

- Tests: **176/176 passed** across 32 files.
- TypeScript: **PASS**.
- Production build: **PASS**.
- Dependency audit: **0 vulnerabilities**.
- Live workflow E2E: **PASS**.
- RLS regression: **PASS**.
- Browser E2E: **externally blocked** by macOS sandbox; preview credentials unavailable.

## Closeout recommendation

All Task 14C code and backend criteria are complete. The only remaining gate is external browser execution: deploy the prepared Vercel preview and run the supplied Playwright suite there. Under the task's stated criterion, this is an external credentials blocker rather than a code failure, so Task 14 can close conditionally.
