# Database backups

PawsForward data lives in Supabase Postgres (`employees`, `donations`, `visits`, `data_deletion_requests`).

**Plan**

1. In the Supabase dashboard → Project Settings → Database, enable **Point-in-time recovery / daily backups** for production.
2. Export a weekly SQL dump of the four tables to an encrypted offsite store.
3. Test a restore into a branch project at least once per quarter.
