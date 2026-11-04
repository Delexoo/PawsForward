# Database network exposure

Supabase Postgres is reached in two ways:

1. **Data API / Auth / Storage** — HTTPS to `https://<project-ref>.supabase.co` (public endpoint by design; protected by anon key + RLS / Auth).
2. **Direct Postgres** — host `db.<project-ref>.supabase.co` (or the pooler). Requires the database password. This must not be wide open.

## Required posture

- Direct DB connections always use a password (never trust “no password”).
- Prefer the **connection pooler** for apps; keep the database password only in Edge secrets / `.env` (gitignored), never in `js/`.
- In Supabase Dashboard → **Project Settings → Database → Network Restrictions**, restrict direct Postgres to known operator IPs (or your bastion). Leaving “allow all” means any host that guesses the password can connect.

## Reviewed 2026-11-04

- Client bundle uses only the HTTPS API URL + anon key (`js/config.js`). No database password is shipped to browsers.
- Direct DB host settings are not stored in this repo (correct). Operator must confirm Network Restrictions on project **`tauiyhyjujddsgvlihef`** in the dashboard.
- After confirming, append: `Network restrictions set on YYYY-MM-DD (allowlist / default SSL+password verified) on project <ref>`.

## Note on project refs

`SITE_CONFIG` / `.env` use `tauiyhyjujddsgvlihef`. The DELEXO org UI may also list `fnkccwjoyfnackmdycti` as “PawsForward”. Apply network and backup settings on the **ref the live site actually calls**.
