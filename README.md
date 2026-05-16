# LocalCoKitchen coming soon page

Static landing page for the LocalCoKitchen waitlist.

## Files

- `index.html` - landing page markup and waitlist form
- `styles.css` - responsive visual design
- `script.js` - form submission enhancement

## Waitlist form

The form is set up with Netlify-compatible static form attributes:

```html
data-netlify="true"
```

If this is deployed somewhere else, replace the `fetch("/")` target in
`script.js` with the waitlist endpoint for that host or backend.
