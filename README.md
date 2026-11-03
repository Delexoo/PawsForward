# PawsForward

Admin dashboard and public donate page for **PawsForward**, a dog-rescue fundraising org. Operators hire employees with unique QR codes; donations through a code attribute to that employee at **25%** owed. The donate page can collect visit/geo analytics after consent.

## Project map

| Path | Role |
|------|------|
| `admin.html` | Signed-in admin dashboard |
| `login.html` | Admin email/password sign-in + reset |
| `donate.html` | Public donate + QR landing |
| `join.html` | Public promoter signup — create your own QR |
| `privacy.html` / `terms.html` / `404.html` | Legal + not found |
| `css/` | `fonts.css`, shared `site.css`, `paws.css` extras |
| `fonts/` | Self-hosted DM Sans + IBM Plex Mono |
| `js/` | Page scripts, `vendor/supabase.js`, shell/icons/theme |
| `supabase/schema.sql` | Tables, RLS, rate-limited RPCs |
| `docs/` | Breach plan, backups, security headers |
| `_headers` | CSP / nosniff / frame policy for Cloudflare or Netlify |
| `tests/` | Commission / attribution unit checks |
| `robots.txt` / `sitemap.xml` / `manifest.webmanifest` | SEO + PWA icons |

## Run locally

```powershell
cd e:\MasterVault\PawsForward
npx --yes serve .
```

Open `/donate.html` or `/login.html` → `/admin.html`.

## Config

1. Copy `.env.example` to `.env` (gitignored).
2. Mirror the same values in `js/config.js` (`supabaseUrl`, `supabaseAnonKey`, `commissionRate`).

## Supabase

Apply [`supabase/schema.sql`](supabase/schema.sql) (or the migrations already applied on the linked project).

**RLS model**

- Anon: cannot read employees/donations/visits tables directly.
- Anon: `resolve_employee_by_code`, `record_donation`, `record_visit` RPCs (rate-limited).
- Anon: insert into `data_deletion_requests`.
- Authenticated admin: full CRUD on employees/donations/visits.

**Default admin (change after first login)**

- Email: `admin@pawsforward.local`
- Password: `PawsForwardAdmin!2026`

## Tests

```powershell
node tests/commission.test.mjs
```

## Hosting notes

- GitHub Pages serves HTTPS and typically gzip/brotli-compresses static text.
- Custom security headers (CSP, etc.) are limited on plain GitHub Pages; put Cloudflare (or similar) in front and apply [`_headers`](_headers) / [`docs/security-headers.md`](docs/security-headers.md).
- Enable Supabase backups in the project dashboard (see `docs/backups.md`).
- Enable Auth **leaked password protection** (and optional MFA) — see `docs/breach-plan.md`.
- Admin auth sessions stay **in memory** (not `localStorage`); sign in again after a full page reload.

## Contact

- General: hello@pawsforward.org  
- Privacy / deletion: privacy@pawsforward.org  
