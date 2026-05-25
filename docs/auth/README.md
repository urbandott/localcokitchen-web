# LocalCoKitchen Auth

This directory documents the first authentication implementation for the static
LocalCoKitchen web app.

## Files

- `AUTHENTICATION.md`: feature behavior and implementation notes.
- `SUPABASE_SETUP.md`: manual Supabase setup required before production use.
- `UI_STYLING.md`: shared auth styling and Next.js migration notes.
- `../../supabase/migrations/202605240001_auth_identity.sql`: database schema,
  RLS policies, and auth trigger.

## Current Scope

- Sign-in page at `/signin/`.
- Sign-up page at `/signup/`.
- Forgot-password page at `/forgot-password/`.
- Password reset page at `/reset-password/`.
- Email/password authentication through Supabase Auth.
- Password reset email request from the sign-in page.
- Password update after the user opens a Supabase reset email.

OAuth with Google and Apple is intentionally deferred. Add those buttons and
Supabase provider setup when the marketplace is ready for social login.
- Identity profile and role records created by a Supabase database trigger.

## Credential Policy

LocalCoKitchen uses email/password for password-based authentication. No other
password login identifier is collected or supported.
