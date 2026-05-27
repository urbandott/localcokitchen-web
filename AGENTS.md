# LocalCoKitchen Agent Guide

This repo is a static HTML/CSS/JavaScript frontend backed by Supabase Auth, Postgres, and Storage. Keep changes small, source-controlled, and compatible with static hosting.

## Project Shape

- Static pages live as `index.html` files under route directories.
- Shared browser behavior lives in `js/`.
- Global styles live in `styles.css`.
- Supabase migrations live in `supabase/migrations/`.
- Supabase browser config lives in `js/supabase-config.js`.
- Security headers for deployed static hosting live in `_headers`.
- Product requirements and planning docs live in `~/Documents/Workspaces/localcokitchen-documents`.

Use a local static server for browser/auth testing. Do not open nested HTML files directly from Finder for app flow testing.

```sh
python3 -m http.server 4174
```

## Supabase Rules

- Use the Supabase CLI for schema work. Check command help before using unfamiliar CLI commands.
- Keep Supabase changes git tracked in migrations; do not make dashboard-only schema changes without adding equivalent SQL.
- The app-owned schemas must be prefixed with `lck_`.
- Current app schemas are:
  - `lck_identity`
  - `lck_marketplace`
  - `lck_private`
- Do not create new custom schemas without the `lck_` prefix.
- Do not drop or rename Supabase-owned schemas, including `auth`, `storage`, `realtime`, `extensions`, `graphql`, `graphql_public`, `supabase_functions`, `vault`, `pgsodium`, or Postgres system schemas.
- Do not delete the `public` schema. It is expected by Postgres/Supabase tooling even if app tables are not stored there.
- Keep privileged helper functions out of exposed schemas unless there is a deliberate reason. Prefer `lck_private` for internal `security definer` trigger helpers.
- Public/anonymous RPCs must be reviewed for user-enumeration and privacy impact before exposing them.

## Database And API Exposure

- Expose app tables through `lck_marketplace` and app RPCs through the intended schema only.
- `supabase/config.toml` should include any app schema that the browser must access through PostgREST.
- Enable RLS on every table in exposed schemas.
- Policies must combine authentication with row ownership or an explicit admin/cook approval predicate.
- Do not use user-editable `user_metadata` for authorization. Use database roles/tables such as `lck_identity.user_roles`.

## Auth And Privacy

- Signup should not reveal whether an email is registered.
- If pre-checking account status to prevent duplicate emails, show the same generic message for existing and newly-created accounts.
- Forgot-password messaging should remain generic.
- Never expose service role keys, database passwords, or secret keys in frontend code.

## Storage

- Buckets and storage policies belong in migrations.
- Current buckets:
  - `profile-images`
  - `cook-documents`
  - `cook-profile-images`
  - `cook-menu-images`
- When adding image sources, update `_headers` CSP `img-src` if production rendering needs a new origin.
- Deleting profile images should remove the object from Storage when the app has the stored path.

## Frontend Conventions

- Navbar appears on all pages, including auth pages.
- Signed-in nav state is resolved in the browser. Auth-dependent links should start hidden with `is-auth-loading` to avoid a sign-in flash.
- Keep CSS cache versions numeric only, for example `styles.css?v=20260526`.
- Avoid `innerHTML` for user-controlled content. Build DOM nodes and set `textContent`/properties.
- Keep UI controls responsive; verify important changed routes return `200`.

## Verification

Run relevant checks before finishing:

```sh
node --check js/auth.js
node --check js/auth-nav.js
node --check js/cook.js
node --check js/admin.js
npm test
```

For route checks with the local server running:

```sh
curl -I http://127.0.0.1:4174/
curl -I http://127.0.0.1:4174/signin/
curl -I http://127.0.0.1:4174/signup/
curl -I http://127.0.0.1:4174/profile/
curl -I http://127.0.0.1:4174/sell-your-food/
curl -I http://127.0.0.1:4174/my-shop/
```

For Supabase migrations, dry-run first when targeting a linked remote project:

```sh
supabase db push --linked --dry-run
```

Do not push to the remote database unless the user explicitly wants that change applied.
