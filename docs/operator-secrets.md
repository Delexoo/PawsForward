# Operator login secrets

PIN is no longer stored in `js/config.js`. The `operator-login` Edge Function reads values from Edge secrets **or** `private.app_secrets` via `app_secret`.

| Key | Purpose |
| --- | --- |
| `operator_pin` / `OPERATOR_PIN` | 4-digit PIN operators type on login.html |
| `operator_email` / `OPERATOR_EMAIL` | Internal Auth user email |
| `operator_auth_password` / `OPERATOR_AUTH_PASSWORD` | Long random Auth password (Edge-only) |
| `ALLOWED_ORIGINS` | Optional comma-separated extra CORS origins |
| `twilio_account_sid` / `TWILIO_ACCOUNT_SID` | Twilio Account SID for welcome SMS/MMS |
| `twilio_auth_token` / `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `twilio_from_number` / `TWILIO_FROM_NUMBER` | Twilio From number in E.164 (e.g. `+15551234567`) |
| `SITE_ORIGIN` | Canonical site origin used in SMS links (e.g. `https://joinpawsforward.com`) |

After signup, `welcome-promoter` texts the promoter their donate link + QR page (and attaches a QR image when MMS is allowed). Apply `supabase/migrations/20261106_promoter_welcome_sends.sql` so sends are logged once per promoter.

Public tables are locked for `anon`. Admin CRUD requires a successful operator-login session (authenticated role). Failed and successful PIN attempts are written to `operator_login_events`.
