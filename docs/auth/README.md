# LocalCoKitchen Auth

LocalCoKitchen authentication is now implemented in the Next.js App Router app with Supabase Auth.

## Files

- `app/(auth)/signin/page.tsx` — sign-in route
- `app/(auth)/signup/page.tsx` — sign-up route
- `app/(auth)/forgot-password/page.tsx` — password reset request route
- `app/(auth)/reset-password/page.tsx` — password update route
- `features/auth/actions.ts` — server actions for sign-in, sign-up, reset, and sign-out
- `features/auth/auth-form.tsx` — shared client form component
- `lib/auth/session.ts` — current user/admin authorization helpers
- `lib/supabase/server.ts` — server Supabase client
- `lib/supabase/browser.ts` — browser Supabase client
- `proxy.ts` — session refresh and private-route noindex headers
- `supabase/migrations/` — auth/profile/role schema, RLS policies, RPCs, and triggers

Legacy static auth files still exist during migration but should not be used as the primary implementation.

## Current scope

- Email/password sign-in at `/signin/`
- Account creation at `/signup/`
- Password reset request at `/forgot-password/`
- Password update at `/reset-password/`
- Authenticated profile route at `/profile/`
- Cook dashboard route at `/my-kitchen/`
- Admin routes under `/admin/`
- Admin authorization through database role/RPC checks, not user-editable metadata
- Generic signup/reset messages to avoid account enumeration

OAuth with Google and Apple remains deferred.

## Credential policy

LocalCoKitchen uses email/password for password-based authentication. No other password login identifier is collected or supported.

Password policy is enforced in Supabase config and UI/server validation:

- Minimum length: 10
- Lowercase letters
- Uppercase letters
- Digits
- Symbols

## Security notes

- Do not expose a service-role key to the Next.js app.
- Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- RLS and RPC authorization remain the primary data boundary.
- Private route groups are marked `noindex`.
- Redirects are constrained to local paths.
