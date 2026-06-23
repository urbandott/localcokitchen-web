# Testing

This project uses a mixed test suite during the migration from static HTML/CSS/JS to Next.js.

## Test commands

Run all non-E2E tests:

```sh
npm test
```

Run the legacy Node tests only:

```sh
npm run test:legacy
```

Run the Next.js/Vitest tests only:

```sh
npm run test:unit
```

Run Playwright E2E tests:

```sh
npm run test:e2e
```

If Playwright browsers are missing:

```sh
npx playwright install chromium
```

## Required verification before handoff

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
npm audit
supabase db push --linked --dry-run
```

The Supabase dry-run may fail until remote migration-history drift is reconciled. Do not push remote migrations until the dry-run is clean.

## Current coverage

Legacy Node tests in `test/` cover:

- Password policy behavior
- Static-route safety checks
- Security regression checks for legacy browser code
- Customer menu helper regressions

Vitest tests in `tests/` cover:

- Cart quantity clamping, dedupe, subtotal, invalid quantity handling
- Menu search/filter matching
- Safe redirect handling
- Next.js security regressions, including no unsafe HTML sinks and no service-role exposure

Playwright tests in `tests/e2e/` cover:

- Public route smoke
- Menu route controls
- Private route redirects
- Mobile menu overflow smoke

## Testing rules

- Keep pure business logic in `features/` or `lib/` so it can be unit tested without a browser.
- Test authorization helpers separately from UI where possible.
- Do not rely on client-side cart values for checkout tests; checkout must revalidate server-side when implemented.
- Add regression tests for every security-sensitive fix.
- Keep E2E tests focused on high-value flows to avoid a slow/flaky default suite.

## Supabase-backed testing notes

The app uses Supabase RLS/RPCs as the primary data boundary. Integration tests that require real Supabase data should use a controlled test project or seeded local Supabase instance. Do not use production data for automated tests.

Before running database migration tests against a linked remote project:

```sh
supabase db push --linked --dry-run
```
