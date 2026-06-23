# Supabase Setup

These steps are required before local or production auth/database-backed flows work.

## 1. Configure environment variables

Create `.env.local` from the example:

```sh
cp .env.example .env.local
```

Set:

```text
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use the project URL and publishable key from:

```text
Supabase Dashboard > Project Settings > API
```

Never put the service-role key in frontend code or a `NEXT_PUBLIC_*` variable.

## 2. Run or reconcile migrations

Supabase migrations are tracked in:

```text
supabase/migrations/
```

For a linked remote project, always dry-run first:

```sh
supabase db push --linked --dry-run
```

Current known blocker: the linked remote migration ledger includes versions missing locally:

```text
202605240001
20260526014506
20260526202250
20260526210427
20260526232914
```

Reconcile those before pushing. Do not use dashboard-only schema changes.

## 3. Configure URL settings

In Supabase Dashboard:

```text
Authentication > URL Configuration
```

Set production Site URL:

```text
https://localcokitchen.com
```

Add production redirect URLs:

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
```

Add local Next.js redirect URLs:

```text
http://127.0.0.1:3000/
http://127.0.0.1:3000/signin/
http://127.0.0.1:3000/signup/
http://127.0.0.1:3000/forgot-password/
http://127.0.0.1:3000/reset-password/
```

If you also test the legacy static preview, add the port you actually use, for example `http://127.0.0.1:4174/`.

## 4. Enable email/password auth

In Supabase Dashboard:

```text
Authentication > Providers > Email
```

Keep email/password enabled and keep email confirmation enabled for production.

Configure the password policy:

- Minimum length: `10`
- Require lowercase letters
- Require uppercase letters
- Require digits
- Require symbols

## 5. Configure session controls

In Supabase Dashboard:

```text
Authentication > Sessions
```

Recommended production baseline:

- JWT expiry: default `1 hour`, or lower only after testing refresh behavior
- Inactivity timeout: `12 hours`
- Time-boxed session lifetime: `7 days`
- Consider stricter controls for admin accounts

## 6. Admin role grants

Admin access must be granted through database roles/tables, not user-editable metadata.

Use the current `lck_identity.user_roles` table:

```sql
insert into lck_identity.user_roles (user_id, role)
values ('USER_UUID_HERE', 'admin')
on conflict do nothing;
```

Use `super_admin` only for trusted owner-level accounts if supported by the current role policy.

## 7. Cook review notification email

Cook approval/rejection email delivery uses the `send-cook-review-notifications` Edge Function and Resend.

Configure secrets:

```sh
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
supabase secrets set 'COOK_REVIEW_FROM_EMAIL=LocalCoKitchen <notifications@localcokitchen.com>'
```

Deploy:

```sh
supabase functions deploy send-cook-review-notifications
```

Do not put the Resend API key in browser JavaScript or commit it to the repo.

## 8. Test checklist

After configuration:

1. Run `npm run dev`.
2. Open `/signin/`.
3. Create an account at `/signup/`.
4. Confirm email if confirmation is enabled.
5. Confirm identity/profile rows are created through the migrations/triggers.
6. Test password reset from `/forgot-password/` through `/reset-password/`.
7. Confirm private routes redirect when signed out.
8. Confirm admin routes require the admin role.
