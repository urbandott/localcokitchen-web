# Auth UI Styling

Auth pages are now part of the Next.js App Router app and use the global stylesheet imported by:

```text
app/globals.css
```

`app/globals.css` imports the legacy `styles.css` so existing visual tokens and reusable classes can be preserved during the migration.

## Current files

- `features/auth/auth-form.tsx` — shared auth form component
- `app/(auth)/signin/page.tsx`
- `app/(auth)/signup/page.tsx`
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `app/globals.css`
- `styles.css`

## Styling rules

- Keep form controls labeled.
- Keep auth routes keyboard-accessible.
- Keep error/success messages visible and announced with `aria-live` where appropriate.
- Prefer shared classes and components over route-specific duplicated markup.
- Avoid unsafe HTML injection.
- Do not add third-party scripts to auth/admin routes without a security review.

## Useful classes

- `.content-page`
- `.page-hero`
- `.auth-card`
- `.next-form`
- `.next-alert`
- `.primary-action`
- `.secondary-action`
- `.text-button`

## Legacy static pages

Legacy static auth pages still exist during migration and may still link `styles.css` directly. They are not the primary implementation. Validate current auth UX through:

```sh
npm run dev
```

Then open:

```text
http://127.0.0.1:3000/signin/
http://127.0.0.1:3000/signup/
http://127.0.0.1:3000/forgot-password/
http://127.0.0.1:3000/reset-password/
```
