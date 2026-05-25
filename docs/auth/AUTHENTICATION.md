# Authentication Implementation

## Product Alignment

The PRD requires customer and cook authentication with:

- Email and password signup.
- Password reset.

Google and Apple login are deferred for a later release.

The system design recommends Supabase Auth, Supabase PostgreSQL, explicit
multi-role access, and a future role model that can support narrower admin
roles. The migration implements that foundation with:

- `identity.users`
- `identity.user_roles`
- `identity.user_role`

## Routes

### `/signin/`

The sign-in page includes:

- Email/password sign in.
- Link to `/forgot-password/` for password recovery.
- Link to `/signup/` for users who have not signed up.

### `/signup/`

The sign-up page includes:

- Full name.
- Email/password signup.
- Password requirement checklist with live met/unmet states.
- Password confirmation match validation.
- Password preview controls.
- Customer, cook, or both role intent.
- Link back to `/signin/`.

### `/reset-password/`

The reset page accepts the Supabase password recovery session and lets the user
set a new password with `updateUser()`.

### `/forgot-password/`

The forgot-password page asks for an email address and sends a Supabase recovery
email with `resetPasswordForEmail()`. The success message is intentionally
generic so the UI does not reveal whether an email address has an account.

## Client Files

### `/js/supabase-config.js`

Stores the public Supabase browser configuration:

```js
window.LOCALCOKITCHEN_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY",
};
```

The publishable key is safe for browser use. Do not place service-role keys or
other secrets in this file.

### `/js/auth.js`

Owns browser-side auth behavior:

- Creates the Supabase browser client.
- Calls `signInWithPassword()` for email/password sign in.
- Calls `signUp()` for email/password signup.
- Calls `resetPasswordForEmail()` on `/forgot-password/` for password recovery.
- Calls `updateUser()` on `/reset-password/` to save a new password.

## Database Behavior

The migration creates an `identity.handle_new_auth_user()` trigger on
`auth.users`. When Supabase Auth creates a user, the trigger:

1. Inserts a row in `identity.users`.
2. Grants the `customer` role by default.
3. Grants the `cook` role too when the sign-up metadata contains
   `signup_role = cook` or `signup_role = both`.

## Credential Policy

Password-based authentication uses email and password only. No other password
login identifier is collected in the auth flow or stored in the identity profile.

## Password Policy

Signup passwords must satisfy every rule before the app calls Supabase:

- At least 10 characters.
- At least one lowercase letter.
- At least one uppercase letter.
- At least one digit.
- At least one symbol.
- Password and confirmation fields must match.

Mirror these requirements in Supabase Auth password settings where available so
server-side validation matches the browser-side experience.

## Redirects

The client uses:

- Email confirmation redirect: `/signin/?verified=1`
- Forgot-password page: `/forgot-password/`
- Password reset redirect: `/reset-password/`
Configure these URLs in Supabase Auth URL settings before testing production
email confirmations and password recovery.

## Security Notes

- RLS is enabled for `identity.users` and `identity.user_roles`.
- Users can read and update their own identity profile.
- Users can read their own roles.
- Admin-role users can read all identity profiles and roles.
- Public browser code only uses the Supabase publishable key.
- Service-role operations and admin role grants should be implemented
  server-side.

## Supabase References

- JavaScript email/password sign in:
  <https://supabase.com/docs/reference/javascript/auth-signinwithpassword>
- JavaScript sign up:
  <https://supabase.com/docs/reference/javascript/auth-signup>
- Password reset email:
  <https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail>
- Password update:
  <https://supabase.com/docs/reference/javascript/auth-updateuser>
