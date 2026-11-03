# Security headers

GitHub Pages does not let this repo set CSP / nosniff / frame / referrer headers on responses.

This repo ships a Cloudflare / Netlify-style [`_headers`](../_headers) file so a reverse proxy or alternate static host can apply:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `X-Frame-Options` / frame-ancestors
- `Permissions-Policy`

**Recommended:** put Cloudflare in front of `delexoo.github.io/PawsForward` (or move the site to Cloudflare Pages) and map the `_headers` rules, or paste the CSP from that file into a Transform Rule.
