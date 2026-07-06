# Authentication Implementation

## Product alignment

LocalCoKitchen requires customer, cook, and admin authentication with:

- Email/password sign-up and sign-in
- Password reset
- Cook application/profile access
- Admin-only review, directory, metrics, and moderation routes

Google and Apple login remain deferred.

## Architecture

The primary auth implementation is in the Next.js App Router app:

- `app/(auth)/signin/page.tsx`
- `app/(auth)/signup/page.tsx`
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `features/auth/actions.ts`
- `features/auth/auth-form.tsx`
- `lib/auth/session.ts`
- `lib/supabase/server.ts`
- `lib/supabase/browser.ts`
- `proxy.ts`

Supabase remains the source of truth for authentication, sessions, RLS, roles, and storage access.

## Routes

### `/signin/`

- Email/password sign-in
- Generic failed-login message
- Safe local `next` redirect handling
- Links to password reset and account creation

### `/signup/`

- Account creation
- Strong password validation
- Generic post-submit message to avoid account enumeration

### `/forgot-password/`

- Accepts an email address
- Calls Supabase password recovery
- Always returns a generic success path so the UI does not reveal whether the email exists

### `/reset-password/`

- Lets a user with a valid recovery session set a new password

### `/profile/`

- Requires an authenticated Supabase user
- Shows account actions and links to cook dashboard

### `/my-kitchen/`

- Requires an authenticated Supabase user
- Reads cook application/profile/menu data through RLS
- Shows the moderator-disabled kitchen message when applicable

### `/admin/*`

- Requires authenticated user plus admin database role/RPC authorization
- Admin sign-in redirects through the normal sign-in route with `next=/admin/`

## Database behavior

Current application schemas:

- `lck_identity`
- `lck_marketplace`
- `lck_private`

Identity/profile/role rows are created and protected by migrations in `supabase/migrations/`.

Authorization must use database tables/RPCs such as:

- `lck_identity.user_roles`
- `lck_identity.current_user_is_admin()`

Do not use user-editable metadata for authorization decisions.

## Credential policy

Password-based authentication uses email and password only. No other password login identifier is collected or supported.

Password requirements:

- At least 10 characters
- Lowercase letter
- Uppercase letter
- Digit
- Symbol

Mirror these in Supabase Auth settings and keep the UI/server validation aligned.

## Redirects

Allowed local auth URLs for Next.js development:

```text
http://127.0.0.1:3000/
http://127.0.0.1:3000/signin/
http://127.0.0.1:3000/signup/
http://127.0.0.1:3000/forgot-password/
http://127.0.0.1:3000/reset-password/
```

Production URLs should use the same paths under `https://localcokitchen.com` and `https://www.localcokitchen.com`.

## Security notes

- Next.js uses secure headers from `next.config.ts`.
- Private route groups are marked `noindex`.
- `proxy.ts` refreshes Supabase sessions and adds private-route `X-Robots-Tag`.
- Browser/client code does not use service-role keys.
- Auth server actions validate inputs with Zod.
- Redirects are constrained to local paths.
- Public menu data must not expose private cook fields.
- Admin authorization is checked server-side before admin data/actions.
- RLS remains the primary row-level data boundary.

## Supabase references

- Email/password sign in: <https://supabase.com/docs/reference/javascript/auth-signinwithpassword>
- Sign up: <https://supabase.com/docs/reference/javascript/auth-signup>
- Password reset email: <https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail>
- Password update: <https://supabase.com/docs/reference/javascript/auth-updateuser>
