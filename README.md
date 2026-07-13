# LocalCoKitchen Web

LocalCoKitchen is a marketplace web app where customers browse menu items from approved home cooks, cooks manage their kitchens, and admins review/moderate cooks.

This repository now contains a production-oriented Next.js App Router application backed by Supabase Auth, Postgres, Storage, RLS, and Edge Functions. The legacy static HTML/CSS/JS files are still present during the migration, but the local development workflow is Next.js-first.

## Requirements

- Node.js compatible with the installed toolchain
- npm
- Supabase project credentials for real auth/database/storage testing
- Supabase CLI for migration dry-runs and deployment checks

## Local setup

Install dependencies:

```sh
npm install
```

Create a local env file:

```sh
cp .env.example .env.local
```

Fill in:

```text
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Do not add a service-role key to the frontend. The Next.js app is designed to use the Supabase publishable key plus RLS/RPC authorization.

Server-only features also require private environment variables in `.env.local` or the deployment environment:

```text
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SUPABASE_SECRET_KEY
NOTIFICATION_WORKER_SECRET=LONG_RANDOM_WORKER_SECRET
NOTIFICATION_ALERT_EMAIL=ops@localcokitchen.com
RESEND_API_KEY=YOUR_RESEND_API_KEY
RESEND_FROM_EMAIL=LocalCoKitchen <orders@localcokitchen.com>
```

Never prefix these values with `NEXT_PUBLIC_`; they must remain server-only.

## Run locally

Start the Next.js dev server:

```sh
npm run dev
```

Open:

- Home: `http://127.0.0.1:3000/`
- Menu: `http://127.0.0.1:3000/menu/`
- Sign in: `http://127.0.0.1:3000/signin/`
- Sign up: `http://127.0.0.1:3000/signup/`
- Profile: `http://127.0.0.1:3000/profile/`
- My Kitchen: `http://127.0.0.1:3000/my-kitchen/`
- Admin: `http://127.0.0.1:3000/admin/`

If Supabase env vars are missing, public pages still render, but auth/database-backed sections show unavailable states or redirect as expected.

## Supabase setup

Supabase schema changes live in:

```text
supabase/migrations/
```

Before applying migrations to a linked remote project, always dry-run:

```sh
supabase db push --linked --dry-run
```

Current known deployment blocker: the linked remote migration history contains versions that are not present locally:

```text
202605240001
20260526014506
20260526202250
20260526210427
20260526232914
```

Reconcile that migration history before pushing new database changes.

Supabase Auth redirect URLs for local Next.js development should include:

```text
http://127.0.0.1:3000/
http://127.0.0.1:3000/signin/
http://127.0.0.1:3000/signup/
http://127.0.0.1:3000/forgot-password/
http://127.0.0.1:3000/reset-password/
```

Production redirect URLs should include the same paths under:

```text
https://localcokitchen.com
https://www.localcokitchen.com
```

## Scheduled notifications

Order lifecycle emails are queued in `lck_private.notification_outbox` and delivered by the server-only route:

```text
/api/notifications/resend
```

The repository includes `vercel.json` with a Vercel Cron schedule that calls this route every 5 minutes. Vercel Cron uses HTTP `GET`, so the route accepts Vercel cron requests that include the expected cron user agent and schedule header. Manual or external worker calls should use `POST` with:

```text
Authorization: Bearer YOUR_NOTIFICATION_WORKER_SECRET
```

The worker requires `SUPABASE_SECRET_KEY`, `NOTIFICATION_WORKER_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in the deployment environment. Set `NOTIFICATION_ALERT_EMAIL` to send throttled operational health alerts when failed notifications or stale pending notifications indicate delivery problems.

## Verification

Run the normal local verification suite:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Dependency audit:

```sh
npm audit
```

Supabase dry-run:

```sh
supabase db push --linked --dry-run
```

## Scripts

- `npm run dev` — run Next.js locally on `127.0.0.1:3000`
- `npm run build` — production build
- `npm run start` — run production server locally
- `npm run typecheck` — strict TypeScript check
- `npm run lint` — ESLint
- `npm run format:check` — Prettier check for migrated app/test/config files
- `npm test` — legacy Node tests plus Vitest tests
- `npm run test:e2e` — Playwright E2E tests
- `npm run analyze` — build with bundle analyzer enabled

## Project structure

- `app/` — Next.js App Router pages, layouts, route handlers, sitemap, robots, errors
- `components/` — shared UI shell components
- `features/` — feature-owned code for auth, admin, cart, kitchen, and menu
- `lib/` — Supabase clients, auth/session helpers, validation, security, SEO, utilities
- `types/` — typed database/RPC contracts
- `tests/` — Vitest and Playwright tests
- `test/` — legacy Node regression tests
- `public/images/` — Next.js-served static image assets
- `supabase/migrations/` — source-controlled Supabase migrations
- `supabase/functions/` — Supabase Edge Functions
- `docs/` — implementation, testing, migration, and audit documentation

## Legacy static preview

The old static pages remain in the repository during migration. If you need to inspect them directly, run:

```sh
python3 -m http.server 4174
```

Then open `http://127.0.0.1:4174/`.

Do not use the legacy static server for validating the new Next.js implementation.
