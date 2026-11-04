# DNS checklist for joinpawsforward.com

GitHub Pages custom domains need records that still match a live Pages site.

## Confirm
1. In the DNS host for `joinpawsforward.com`, list A / AAAA / CNAME records for apex and `www`.
2. Remove any record that points at a deleted host, old Pages project, or unused service.
3. For GitHub Pages user/org sites, follow GitHub’s current custom domain docs (often A records for apex + CNAME for www, or ALIAS where supported).
4. In the GitHub repo Settings → Pages, set the custom domain and wait for DNS check to pass.
5. After DNS is green, set `SITE_CONFIG.siteOrigin` to `https://joinpawsforward.com` and redeploy.
