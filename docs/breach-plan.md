# Breach response plan

1. **Detect.** Watch Supabase Auth sign-in failures, dashboard error banners, and project logs/advisors.
2. **Contain.** Rotate the anon key if abused, revoke admin sessions, tighten RLS, and pause public RPCs if needed.
3. **Assess.** List tables touched (employees, donations, visits, deletion requests, auth.users).
4. **Notify.** Email affected people using stored contacts (donor labels/emails on deletion requests, employee phones via operator outreach, admin emails) within 72 hours when personal data is involved.
5. **Record.** Note timeline, systems affected, and fixes in an internal incident log.
6. **Follow up.** Offer deletion via privacy@pawsforward.org and the privacy form.
