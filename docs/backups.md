# Database backups

PawsForward data lives in Supabase Postgres (`employees`, `donations`, `visits`, `data_deletion_requests`) on project `tauiyhyjujddsgvlihef` (LarpCity).

**Plan**

1. In the Supabase dashboard → Project Settings → Database, enable **Point-in-time recovery / daily backups** for production.
2. Export a weekly SQL dump of the four tables to an encrypted offsite store.
3. Test a restore into a branch project at least once per quarter.

**Status**

- Operator checklist item opened: **2026-11-03**.
- Action required in dashboard (free-tier projects may only offer daily backups; upgrade for PITR): Database → Backups → enable and confirm the next scheduled snapshot date here after first success.
- After enabling, append: `Enabled on YYYY-MM-DD (daily / PITR)`.
