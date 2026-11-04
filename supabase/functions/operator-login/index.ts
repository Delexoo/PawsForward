import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { corsHeaders } from "./cors.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string | null {
  const forwarded = String(req.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("true-client-ip"),
    req.headers.get("x-real-ip"),
    ...forwarded,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  for (const raw of candidates) {
    const ip = raw.replace(/^::ffff:/i, "");
    if (ip) return ip.slice(0, 64);
  }
  return null;
}

async function logAttempt(
  admin: ReturnType<typeof createClient>,
  row: { ok: boolean; reason: string; ip: string | null; ua: string | null }
) {
  try {
    await admin.from("operator_login_events").insert({
      ok: row.ok,
      reason: row.reason,
      ip: row.ip,
      user_agent: row.ua,
    });
  } catch {
    /* table may be locked from roles; service role bypasses RLS */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  const ip = clientIp(req);
  const ua = String(req.headers.get("user-agent") || "").slice(0, 240) || null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SB_PUBLISHABLE_KEY") || "";
  const admin = createClient(supabaseUrl, serviceKey);

  async function secret(key: string, envName: string) {
    const fromEnv = String(Deno.env.get(envName) || "").trim();
    if (fromEnv) return fromEnv;
    const { data, error } = await admin.rpc("app_secret", { p_key: key });
    if (error) throw error;
    return String(data || "").trim();
  }

  let pinExpected = "";
  let email = "operators@pawsforward.internal";
  let authPassword = "";
  try {
    pinExpected = String(await secret("operator_pin", "OPERATOR_PIN")).replace(/\D/g, "");
    email = (await secret("operator_email", "OPERATOR_EMAIL")) || email;
    authPassword = await secret("operator_auth_password", "OPERATOR_AUTH_PASSWORD");
  } catch (err) {
    console.error(err);
    await logAttempt(admin, { ok: false, reason: "secret_read_failed", ip, ua });
    return json(req, { error: "Operator login is not configured." }, 503);
  }

  if (pinExpected.length !== 4 || !authPassword) {
    await logAttempt(admin, { ok: false, reason: "not_configured", ip, ua });
    return json(req, { error: "Operator login is not configured." }, 503);
  }

  let body: { pin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON" }, 400);
  }

  const pin = String(body.pin || "").replace(/\D/g, "").slice(0, 4);
  if (pin.length !== 4) {
    await logAttempt(admin, { ok: false, reason: "invalid", ip, ua });
    return json(req, { error: "Enter a 4-digit PIN." }, 400);
  }

  if (pin !== pinExpected) {
    await logAttempt(admin, { ok: false, reason: "mismatch", ip, ua });
    return json(req, { error: "Incorrect PIN." }, 401);
  }

  // Ensure a dedicated Auth user exists for the authenticated RLS role.
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = listed.data?.users?.find(
    (u) => String(u.email || "").toLowerCase() === email.toLowerCase()
  );
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password: authPassword,
      email_confirm: true,
      app_metadata: { role: "operator", pawsforward: true },
    });
    if (created.error || !created.data.user) {
      await logAttempt(admin, { ok: false, reason: "user_create_failed", ip, ua });
      return json(req, { error: "Could not prepare operator session." }, 500);
    }
    user = created.data.user;
  } else {
    await admin.auth.admin.updateUserById(user.id, {
      password: authPassword,
      app_metadata: { ...(user.app_metadata || {}), role: "operator", pawsforward: true },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await userClient.auth.signInWithPassword({
    email,
    password: authPassword,
  });
  if (signed.error || !signed.data.session) {
    await logAttempt(admin, { ok: false, reason: "signin_failed", ip, ua });
    return json(req, { error: "Could not start operator session." }, 500);
  }

  await logAttempt(admin, { ok: true, reason: "ok", ip, ua });
  return json(req, {
    access_token: signed.data.session.access_token,
    refresh_token: signed.data.session.refresh_token,
    expires_in: signed.data.session.expires_in,
    expires_at: signed.data.session.expires_at,
  });
});
