# Operator login secrets

PIN is no longer stored in `js/config.js`. The `operator-login` Edge Function reads values from Edge secrets **or** `private.app_secrets` via `app_secret`.

| Key | Purpose |
| --- | --- |
| `operator_pin` / `OPERATOR_PIN` | 4-digit PIN operators type on login.html |
| `operator_email` / `OPERATOR_EMAIL` | Internal Auth user email |
| `operator_auth_password` / `OPERATOR_AUTH_PASSWORD` | Long random Auth password (Edge-only) |
| `ALLOWED_ORIGINS` | Optional comma-separated extra CORS origins |

Public tables are locked for `anon`. Admin CRUD requires a successful operator-login session (authenticated role). Failed and successful PIN attempts are written to `operator_login_events`.
