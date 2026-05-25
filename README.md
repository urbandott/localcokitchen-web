# LocalCoKitchen coming soon page

Static landing page for the LocalCoKitchen waitlist.

## Test locally

This project is a static HTML/CSS/JS site. Run it from the repo root with a
local static server:

```sh
python3 -m http.server 8000
```

Then open:

- Homepage: `http://localhost:8000/`
- Sign in: `http://localhost:8000/signin/`
- Sign up: `http://localhost:8000/signup/`
- Reset password: `http://localhost:8000/reset-password/`

Do not open the nested HTML files directly from Finder for auth testing. Use the
local server so relative paths, redirects, scripts, and Supabase callback URLs
behave like a deployed site.

### Auth testing

Before Supabase is configured, the auth pages should load visually and show this
status message:

```text
Supabase is not configured yet. Add your project URL and publishable key in /js/supabase-config.js.
```

To test real sign-in/sign-up:

1. Run the SQL migration in `supabase/migrations/`.
2. Update `js/supabase-config.js` with your Supabase project URL and publishable key.
3. Add the localhost redirect URLs from `docs/auth/SUPABASE_SETUP.md` in Supabase Auth URL Configuration.
4. Enable the Email provider.
5. Restart the local server if needed and test the auth pages again.

### Quick route checks

With the local server running, these should return `200`:

```sh
curl -I http://localhost:8000/
curl -I http://localhost:8000/signin/
curl -I http://localhost:8000/signup/
curl -I http://localhost:8000/reset-password/
curl -I 'http://localhost:8000/styles.css?v=20260524-auth'
```

## Files

- `index.html` - landing page markup and waitlist form
- `signin/index.html` - Supabase Auth sign-in page
- `signup/index.html` - Supabase Auth sign-up page
- `reset-password/index.html` - Supabase Auth password update page
- `styles.css` - responsive visual design
- `script.js` - form submission enhancement
- `js/auth.js` - Supabase Auth browser behavior
- `js/supabase-config.js` - public Supabase browser configuration
- `supabase/migrations/` - database migrations tracked in source control
- `docs/auth/` - authentication implementation and setup notes
- `sitemap.xml` - canonical sitemap for search crawlers
- `robots.txt` - crawler access rules and sitemap location
- `llms.txt` - concise site context for AI and LLM-based discovery

## Waitlist form

The form is set up with Netlify-compatible static form attributes:

```html
data-netlify="true"
```

If this is deployed somewhere else, replace the `fetch("/")` target in
`script.js` with the waitlist endpoint for that host or backend.
