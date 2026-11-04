# Database backups

PawsForward data lives in Supabase Postgres (`employees`, `donations`, `visits`, `payouts`, `data_deletion_requests`) on project `tauiyhyjujddsgvlihef` (`https://tauiyhyjujddsgvlihef.supabase.co`).

**Plan**

1. In the Supabase dashboard → Project Settings → Database → Backups, enable **daily backups** (Pro) or **Point-in-time recovery** for production.
2. Export a weekly SQL dump of the core tables to an encrypted offsite store.
3. Test a restore into a branch project at least once per quarter.

**Status (reviewed 2026-11-04)**

- App config / `.env` still target project ref **`tauiyhyjujddsgvlihef`**.
- DELEXO org dashboard currently shows a separate Nano project **`fnkccwjoyfnackmdycti`** named PawsForward with **Last backup: No backups** (Free plan — automatic backups / PITR are not available until Pro).
- Action required on the **live** project used by `SITE_CONFIG.supabaseUrl`:
  1. Open that project in the Supabase dashboard.
  2. Confirm which plan it is on.
  3. If Free: upgrade to Pro (or accept that only manual dumps protect data) and enable daily backups.
  4. Append below: `Enabled on YYYY-MM-DD (daily / PITR) on project <ref>`.

**Manual dump (works on Free)**

```powershell
# After linking the CLI to the live project:
supabase db dump -f backups/pawsforward-$(Get-Date -Format yyyyMMdd).sql
```

Store the dump encrypted offsite. A dump with no restore test is incomplete — restore into a branch at least quarterly.
