# Supabase Setup

These steps must be completed manually in Supabase before production auth works.

## 1. Run the Migration

Run this SQL file in Supabase SQL Editor or through the Supabase CLI:

```text
supabase/migrations/202605240001_auth_identity.sql
```

Manual SQL Editor path:

1. Open Supabase Dashboard.
2. Select the LocalCoKitchen project.
3. Go to SQL Editor.
4. Paste the migration contents.
5. Run the query.

CLI path, if this repo is linked to the Supabase project:

```sh
supabase db push
```

## 2. Configure Browser Credentials

Open `/js/supabase-config.js` and replace:

- `https://YOUR_PROJECT_REF.supabase.co`
- `YOUR_SUPABASE_PUBLISHABLE_KEY`

Use the project URL and publishable/anon browser key from:

```text
Supabase Dashboard > Project Settings > API
```

Never use the service-role key in frontend code.

## 3. Configure URL Settings

In Supabase Dashboard:

```text
Authentication > URL Configuration
```

Set Site URL:

```text
https://localcokitchen.com
```

Add Redirect URLs:

```text
https://localcokitchen.com/
https://localcokitchen.com/signin/
https://localcokitchen.com/signup/
https://localcokitchen.com/forgot-password/
https://localcokitchen.com/reset-password/
https://www.localcokitchen.com/
https://www.localcokitchen.com/signin/
https://www.localcokitchen.com/signup/
https://www.localcokitchen.com/forgot-password/
https://www.localcokitchen.com/reset-password/
http://localhost:8000/
http://localhost:8000/signin/
http://localhost:8000/signup/
http://localhost:8000/forgot-password/
http://localhost:8000/reset-password/
```

Use the local port that you actually run for static preview.

## 4. Enable Email/Password Auth

In Supabase Dashboard:

```text
Authentication > Providers > Email
```

Confirm that email/password auth is enabled. Hosted Supabase projects usually
require email confirmation by default. Keep confirmation enabled for production.

Configure the password policy to match the signup UI:

- Minimum length: `10`
- Require lowercase letters
- Require uppercase letters
- Require digits
- Require symbols

## 5. Configure Session Controls

In Supabase Dashboard:

```text
Authentication > Sessions
```

Use production session controls so stolen browser sessions have a bounded life:

- Keep JWT expiry at the default `1 hour`, or lower it only if you have tested
  refresh behavior. Supabase recommends not going below `5 minutes`.
- Enable an inactivity timeout. Start with `12 hours` for marketplace accounts.
- Enable a time-boxed session lifetime. Start with `7 days`.
- Consider single-session-per-user for admin accounts once an admin UI exists.

These settings are enforced when sessions refresh, so existing sessions may not
be terminated immediately.

## 6. Deferred OAuth

Google and Apple OAuth are not currently exposed in the UI. When social login is
needed, add the buttons back to the auth pages, wire `signInWithOAuth()`, and
enable the providers in Supabase.

Provider docs:

- Google: <https://supabase.com/docs/guides/auth/social-login/auth-google>
- Apple: <https://supabase.com/docs/guides/auth/social-login/auth-apple>

## 7. Test Checklist

After deploy:

1. Open `/signin/`.
2. Confirm the page no longer says Supabase is unconfigured.
3. Create a new account at `/signup/`.
4. Confirm the email, if email confirmation is enabled.
5. Confirm a row exists in `identity.users`.
6. Confirm `identity.user_roles` contains `customer`, and `cook` when selected.
7. Test password reset from `/forgot-password/` through `/reset-password/`.

## Manual Admin Role Grants

For now, grant admin roles manually in SQL Editor after the user account exists:

```sql
insert into identity.user_roles (user_id, role)
values ('USER_UUID_HERE', 'admin')
on conflict do nothing;
```

Use `super_admin` only for trusted owner-level accounts.
