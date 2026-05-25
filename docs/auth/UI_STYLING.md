# Auth UI Styling

The auth pages use the same global stylesheet as the landing page:

```text
styles.css
```

The stylesheet is organized into portable blocks:

- Design tokens in `:root`
- Base element styles
- Shared header and brand components
- Landing page styles
- Auth page styles

## Static Page Links

Top-level pages should link the stylesheet like this:

```html
<link rel="stylesheet" href="styles.css?v=20260524-auth">
```

Nested static pages should use a relative parent path:

```html
<link rel="stylesheet" href="../styles.css?v=20260524-auth">
```

This works when previewing files locally, serving with a static server, and
deploying at the domain root. The `v` query string is a cache key; bump it when
changing layout or auth styles.

## Next.js Migration

When this moves into Next.js:

1. Copy `styles.css` into `app/globals.css`.
2. Import it from `app/layout.tsx`:

```tsx
import "./globals.css";
```

3. Convert shared auth markup into reusable components:

```text
components/auth/AuthShell.tsx
components/auth/AuthCard.tsx
components/auth/FieldStack.tsx
components/BrandLink.tsx
```

4. Keep the existing class names at first. They are intentionally global and
component-oriented, so they can be reused without CSS module rewrites.

## Shared Auth Classes

- `.auth-shell`: page width, viewport height, and outer spacing.
- `.auth-header`: top brand row.
- `.auth-panel`: responsive two-column layout.
- `.auth-copy`: page title and supporting copy.
- `.auth-card`: form container.
- `.auth-form`: form layout.
- `.field-stack`: label/input grouping.
- `.auth-submit`: primary submit button.
- `.auth-role-group`: signup role selector.
- `.auth-note`: status text and page-to-page links.

The same classes are used by `/signin/`, `/signup/`, and `/reset-password/`.
