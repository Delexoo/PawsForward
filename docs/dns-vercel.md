# DNS for joinpawsforward.com → Vercel

Production: https://pawsforward-wine.vercel.app  
Custom domains on project `pawsforward`: `joinpawsforward.com`, `www.joinpawsforward.com`

## Squarespace DNS (custom records)

Delete every GitHub Pages record first (`185.199.*` A records and `www` → `*.github.io`).

Then add exactly what Vercel recommends for this project:

| TYPE | NAME | DATA |
|------|------|------|
| A | @ | `216.198.79.1` |
| A | @ | `64.29.17.1` |
| CNAME | www | `e07310ae06b49845.vercel-dns-017.com` |

(No trailing period in Squarespace’s DATA field.)

After DNS propagates, Vercel issues HTTPS automatically. Confirm in the project → Settings → Domains, or run `vercel domains verify joinpawsforward.com`.
