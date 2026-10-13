# Task 14B – UI integration validation

Generated: 2026-10-12

## Result

Task 14B now uses authenticated Supabase data on all normal application routes. Profile, portfolio and transaction writes are persisted through user-scoped server APIs. Development fixtures are not imported by the application runtime.

## Route and data-source coverage

| Area | Route | Source |
|---|---|---|
| Dashboard | `/` | latest owned portfolio snapshot and positions |
| Analysis | `/analysis` | owned filter results and fund scores |
| Funds | `/funds`, `/funds/[id]` | funds, risk, costs, metrics and owned scores |
| Proposals | `/proposals` | owned proposal and proposal funds |
| Portfolio | `/portfolio` | owned portfolio, latest snapshot, positions and target weights |
| Transactions | `/transactions` | owned portfolios/funds; writes through `/api/transactions` |
| Monitoring | `/monitoring` | owned monitoring events, rebalance plan and actions |
| Settings/profile | `/settings`, `/onboarding` | current profile/preferences; writes through `/api/profile` |

Empty datasets render explicit empty states. Missing optional values remain visible as missing rather than being replaced with fixture values.

## Persistence and idempotence

- Profile save 1: version 1 inserted.
- Repeated profile mutation key: no new version.
- New profile mutation key: version 2 inserted.
- Immutable profile revisions: 2.
- Transaction save 1/2 with the same client key: 1/0 inserts.
- Portfolio creation has a user-scoped client idempotence key.
- After a transaction, the API recalculates and stores today's portfolio snapshot from the latest available NAV data.

## Authentication and RLS

- Supabase password login and logout are live.
- The route proxy validates the user server-side.
- Browser code uses only the publishable key; no service-role/secret key reference exists in `app/`, `components/` or `public/`.
- Cross-user write attempts were rejected for profiles, portfolios, transactions and monitoring data.
- Existing cross-user read isolation passed for profiles, portfolios and transactions.
- Validation users and their dependent data are removed after the checks.

## Responsive UI and PWA

- Safari loaded the real local `/login` route and exposed correctly labelled e-mail, password and submit controls.
- Desktop side navigation, mobile bottom navigation, safe-area padding and minimum 44 px touch targets are implemented.
- Manifest uses `display: standalone`, scope `/`, theme metadata, and genuine 192×192 and 512×512 PNG icons with maskable support.
- The service worker caches the static shell only; navigations and authenticated API responses are not cached.

## Automated validation

- Unit/integration/UI smoke tests: **166/166 passed** (31 files).
- TypeScript: **passed**.
- Production build: **passed**.
- Dependency audit: **0 vulnerabilities**.
- Live Supabase UI integration validation: **PASS**.
- Chromium/WebKit E2E specification: implemented, but the local macOS execution sandbox denied both browser processes before page creation (`MachPortRendezvous: Permission denied` / WebKit abort). No application assertion failed because the browsers never launched.

## Remaining limitations

- Saving a profile persists and versions all UI-owned inputs, but does not synchronously run the Task 09–11 filter, score and proposal batch pipeline. Existing results are displayed when those deterministic jobs have run.
- The profile wizard does not yet prefill a previously saved profile for editing.
- Browser automation could not complete the full login-to-logout flow in Chromium/WebKit in this environment. Native Safari verified the live login screen, but a full automated Safari transaction flow was not run.
- No preview deployment was created because no deployment target or credentials are configured in the repository.

## Closeout recommendation

The persistence, authenticated reads, write isolation, idempotence, real-data screens, snapshot refresh and PWA assets are complete. Task 14B should remain **conditionally open** if automatic orchestration of filtering/scoring/proposal generation and a passing browser-driven E2E run are strict release gates. Otherwise the UI integration work itself is ready for review.
